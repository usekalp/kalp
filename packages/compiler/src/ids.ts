import type { IRNodeId } from "@kalphq/sdk";

export const createIdGenerator = () => {
  let counter = 0;
  return (prefix: string): IRNodeId => {
    counter += 1;
    return `${prefix}_${counter}` as IRNodeId;
  };
};
