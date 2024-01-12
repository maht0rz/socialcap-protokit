import {
  RuntimeModule,
  runtimeMethod,
  state,
  runtimeModule,
} from "@proto-kit/module";
import { State, StateMap, assert } from "@proto-kit/protocol";
import { PublicKey, Bool, UInt64 } from "o1js";
import { inject } from "tsyringe";
import { Admin } from "./admin";

@runtimeModule()
export class Judges extends RuntimeModule<Record<string, never>> {
  @state() public judges = StateMap.from<PublicKey, Bool>(PublicKey, Bool);
  @state() public judgeCount = State.from<UInt64>(UInt64);

  public constructor(@inject("Admin") public admin: Admin) {
    super();
  }

  @runtimeMethod()
  public addJudge(judge: PublicKey): void {
    this.admin.assertSenderIsAdmin();
    const judgeCount = this.judgeCount.get();

    this.judges.set(judge, Bool(true));
    this.judgeCount.set(judgeCount.value.add(UInt64.from(1)));
  }

  public assertSenderIsJudge() {
    const senderIsJudge = this.judges.get(this.transaction.sender).value;
    assert(senderIsJudge, "Sender is not a judge");
  }
}
