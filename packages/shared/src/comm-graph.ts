/** Who talks to whom, counted from run traces (roadmap step 1: weights on the graph). */

/** One directed edge between two saved agents, summed over every observed run. */
export type CommEdge = {
  from: string;
  to: string;
  /** Messages sent from -> to. */
  messages: number;
  /** Distinct runs where from sent at least one message to to. */
  runs: number;
  /** messages / everything `from` sent to saved agents (0-1): how much of from's talk goes to to. */
  share: number;
  /** messages / the busiest edge's messages (0-1): for drawing. */
  weight: number;
  lastAt: string;
};

export type CommGraph = {
  edges: CommEdge[];
  totalMessages: number;
  /** Runs that contributed at least one counted message. */
  runsWithMessages: number;
};
