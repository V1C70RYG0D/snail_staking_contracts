import { run } from "hardhat";

export const verifyContract = async (contractAddress: string, args: unknown[]) => {
  return new Promise<void>(async (resolve, reject) => {
    console.log("Verifying contract...");
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: args,
      });
      console.log("Contract verified successfully!");
      resolve();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("verified") &&
        error.message.toLowerCase().includes("already")
      ) {
        console.log("Contract is already verified!");
        resolve();
      } else {
        reject(error);
      }
    }
  });
};
