import {
  RuntimeModule,
  runtimeMethod,
  state,
  runtimeModule,
} from "@proto-kit/module";
import { State, assert } from "@proto-kit/protocol";
import { PublicKey } from "o1js";

@runtimeModule()
export class Admin extends RuntimeModule<Record<string, never>> {
  @state() public admin = State.from<PublicKey>(PublicKey);

  @runtimeMethod()
  public setAdmin(admin: PublicKey): void {
    const currentAdmin = this.admin.get();
    const canSetAdmin = currentAdmin.isSome
      .not()
      .or(this.transaction.sender.equals(currentAdmin.value));

    assert(
      canSetAdmin,
      "Only the current admin can set the admin, or if there is no admin yet"
    );

    this.admin.set(admin);
  }

  public assertSenderIsAdmin() {
    const currentAdmin = this.admin.get();
    const senderIsAdmin = this.transaction.sender.equals(currentAdmin.value);
    assert(senderIsAdmin, "Sender is not admin");
  }
}
