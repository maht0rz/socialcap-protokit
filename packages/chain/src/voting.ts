import {
  RuntimeModule,
  runtimeMethod,
  state,
  runtimeModule,
} from "@proto-kit/module";
import { Bool, Field, Poseidon, Provable, Struct, UInt64 } from "o1js";
import { inject } from "tsyringe";
import { Judges } from "./judges";
import { StateMap, assert } from "@proto-kit/protocol";

export class Vote extends Struct({
  yay: UInt64,
  nay: UInt64,
  expiresAt: UInt64,
}) {}

// for purposes of testing, the voting duration is 1 block
// we also have just one judge - for testing.
export const VOTE_DURATION = 1;

@runtimeModule()
export class Voting extends RuntimeModule<Record<string, never>> {
  @state() public votes = StateMap.from<Field, Vote>(Field, Vote);

  @state() public votesCast = StateMap.from<Field, Bool>(Field, Bool);

  public constructor(@inject("Judges") public judges: Judges) {
    super();
  }

  public createVote(voteId: Field) {
    const storedVote = this.votes.get(voteId);
    assert(storedVote.isSome.not(), "Vote already exists");

    const expiresAt = this.network.block.height.add(UInt64.from(VOTE_DURATION));

    const vote = new Vote({
      yay: UInt64.from(0),
      nay: UInt64.from(0),
      expiresAt,
    });

    this.votes.set(voteId, vote);
  }

  @runtimeMethod()
  public castVote(voteId: Field, castVote: Bool) {
    // check if the sender is a judge
    this.judges.assertSenderIsJudge();

    // check if the vote exists
    const vote = this.votes.get(voteId);
    assert(vote.isSome, "Vote does not exist");

    // check if the vote has expired
    const isVoteExpired = this.network.block.height.greaterThan(
      vote.value.expiresAt
    );
    assert(isVoteExpired.not(), "Vote has expired");

    // prevent double voting
    const voteCastId = Poseidon.hash([
      ...this.transaction.sender.toFields(),
      voteId,
    ]);

    const isVoteCast = this.votesCast.get(voteCastId);
    assert(isVoteCast.isSome.not(), "Vote has already been cast");

    this.votesCast.set(voteCastId, Bool(true));

    // update voting status based on cast vote
    const voteYes = new Vote({
      ...vote.value,
      yay: vote.value.yay.add(UInt64.from(1)),
    });

    const voteNay = new Vote({
      ...vote.value,
      nay: vote.value.nay.add(UInt64.from(1)),
    });

    const updatedVote = Provable.if<Vote>(castVote, Vote, voteYes, voteNay);

    this.votes.set(voteId, updatedVote);
  }
}
