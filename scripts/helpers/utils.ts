function timeout(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export const retry = async <T>(fn: () => Promise<T>, retries = 3, delay = 1000): Promise<T> => {
  try {
    return await fn();
  } catch (error) {
    if (retries === 0) {
      return Promise.reject(error);
    }

    return timeout(delay).then(() => retry(fn, retries - 1, delay));
  }
};
