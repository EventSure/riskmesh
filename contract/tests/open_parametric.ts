import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { OpenParametric } from "../target/types/open_parametric";

describe("open_parametric", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.OpenParametric as Program<OpenParametric>;

  it("placeholder", async () => {
    // TODO: implement full flow once program is compiled and IDL generated.
    // This is a scaffold test to confirm wiring.
    const pid = program.programId;
    if (!pid) {
      throw new Error("programId not set");
    }
  });
});
