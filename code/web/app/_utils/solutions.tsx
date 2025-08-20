import data from "../../public/data/solutions.json";

export type Solution = {
  id: number;
  name: string;
  kategori: string;
  description: string;
};

export const SOLUTIONS: Solution[] = data.solutions;
