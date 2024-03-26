import { run } from "hardhat";

export const verifyContract = async (contractAddress: string, args: unknown[]) => {
  return new Promise<void>(async (resolve, reject) => {
    try {
      await run("verify:verify", {
        address: contractAddress,
        constructorArguments: args,
      });
      resolve();
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.toLowerCase().includes("verified") &&
        error.message.toLowerCase().includes("already")
      ) {
        resolve();
      } else {
        reject(error);
      }
    }
  });
};
