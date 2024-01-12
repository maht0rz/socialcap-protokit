import {
  RuntimeModule,
  runtimeMethod,
  state,
  runtimeModule,
} from "@proto-kit/module";
import { StateMap, assert } from "@proto-kit/protocol";
import { Bool, Field, Poseidon, PublicKey, Struct, UInt64 } from "o1js";
import { Voting } from "./voting";
import { inject } from "tsyringe";

export class Credential extends Struct({
  claim: Field,
  owner: PublicKey,
}) {}

@runtimeModule()
export class Credentials extends RuntimeModule<Record<string, never>> {
  @state() public credentials = StateMap.from<Field, Credential>(
    Field,
    Credential
  );

  public constructor(@inject("Voting") public voting: Voting) {
    super();
  }

  @runtimeMethod()
  public addCredential(claim: Field) {
    const credential = new Credential({
      claim,
      owner: this.transaction.sender,
    });

    const credentialId = Poseidon.hash(Credential.toFields(credential));

    const storedCredential = this.credentials.get(credentialId);
    assert(storedCredential.isSome.not(), "Credential already exists");

    this.credentials.set(credentialId, credential);
    this.voting.createVote(credentialId);
  }
}
