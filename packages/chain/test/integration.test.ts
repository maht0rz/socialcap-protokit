import "reflect-metadata";
import { log } from "@proto-kit/common";
import { TestingAppChain } from "@proto-kit/sdk";
import { Voting } from "../src/voting";
import { Admin } from "../src/admin";
import { Credential, Credentials } from "../src/credentials";
import { Judges } from "../src/judges";
import { Bool, Field, Poseidon, PrivateKey, Provable } from "o1js";

log.setLevel("ERROR");

describe("integration", () => {
  let appChain: TestingAppChain<{
    Voting: typeof Voting;
    Admin: typeof Admin;
    Credentials: typeof Credentials;
    Judges: typeof Judges;
  }>;

  const adminKey = PrivateKey.random();
  const judgeKey = PrivateKey.random();
  const credentialOwnerKey = PrivateKey.random();

  let admin: Admin;
  let judges: Judges;
  let credentials: Credentials;
  let voting: Voting;

  beforeAll(async () => {
    appChain = TestingAppChain.fromRuntime({
      modules: {
        Voting,
        Admin,
        Credentials,
        Judges,
      },

      config: {
        Voting: {},
        Admin: {},
        Credentials: {},
        Judges: {},
      },
    });

    await appChain.start();

    admin = appChain.runtime.resolve("Admin");
    judges = appChain.runtime.resolve("Judges");
    credentials = appChain.runtime.resolve("Credentials");
    voting = appChain.runtime.resolve("Voting");
  });

  it("should set an admin", async () => {
    appChain.setSigner(adminKey);

    const tx = await appChain.transaction(adminKey.toPublicKey(), () => {
      admin.setAdmin(adminKey.toPublicKey());
    });

    await tx.sign();
    await tx.send();

    await appChain.produceBlock();
  });

  it("should add a judge", async () => {
    const tx = await appChain.transaction(adminKey.toPublicKey(), () => {
      judges.addJudge(judgeKey.toPublicKey());
    });

    await tx.sign();
    await tx.send();

    await appChain.produceBlock();
  });

  it("should not add a judge", async () => {
    appChain.setSigner(judgeKey);
    const tx = await appChain.transaction(judgeKey.toPublicKey(), () => {
      judges.addJudge(judgeKey.toPublicKey());
    });

    await tx.sign();
    await tx.send();

    const block = await appChain.produceBlock();

    expect(block?.txs[0].status).toBe(false);
    expect(block?.txs[0].statusMessage).toBe("Sender is not admin");
  });

  it("should create a credential", async () => {
    appChain.setSigner(credentialOwnerKey);
    const claim = Field(0);
    const tx = await appChain.transaction(
      credentialOwnerKey.toPublicKey(),
      () => {
        credentials.addCredential(claim);
      }
    );

    await tx.sign();
    await tx.send();

    await appChain.produceBlock();
  });

  it("should cast a vote", async () => {
    appChain.setSigner(judgeKey);

    // recreate the vote id
    const voteId = Poseidon.hash(
      Credential.toFields(
        new Credential({
          claim: Field(0),
          owner: credentialOwnerKey.toPublicKey(),
        })
      )
    );

    const tx = await appChain.transaction(judgeKey.toPublicKey(), () => {
      voting.castVote(voteId, Bool(true));
    });

    await tx.sign();
    await tx.send();

    await appChain.produceBlock();

    const vote = await appChain.query.runtime.Voting.votes.get(voteId);

    /**
     * To verify a credential, we need to check if the "vote" has been concluded,
     * by comparing the current block height to the vote.expiresAt block height.
     */

    const blockHeight = (await appChain.query.network.currentNetworkState).block
      .height;

    // is credential valid?
    const isCredentialValid =
      vote &&
      vote.expiresAt.toBigInt() <= blockHeight.toBigInt() &&
      vote.yay.toBigInt() > vote.nay.toBigInt();

    expect(isCredentialValid).toBe(true);
  });
});
