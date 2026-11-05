export type FinancialWorkerTask = {
  name: string;
  run: () => Promise<unknown>;
};

export type FinancialWorkerActions = {
  agreementFinalization: () => Promise<unknown>;
  supportPayments: () => Promise<unknown>;
  trackCheckout: () => Promise<unknown>;
  settlement: () => Promise<unknown>;
  ramp: () => Promise<unknown>;
  cashOut: () => Promise<unknown>;
};

export function createFinancialWorkerTasks(
  actions: FinancialWorkerActions,
  options: { settlementReady?: boolean } = {},
): FinancialWorkerTask[] {
  const tasks: FinancialWorkerTask[] = [
    { name: "Agreement finalization", run: actions.agreementFinalization },
    { name: "Support payments", run: actions.supportPayments },
    { name: "Track checkout", run: actions.trackCheckout },
  ];
  if (options.settlementReady !== false) {
    tasks.push({ name: "Settlement", run: actions.settlement });
  }
  tasks.push(
    { name: "Ramp", run: actions.ramp },
    { name: "Cash-out", run: actions.cashOut },
  );
  return tasks;
}

export async function runFinancialWorkerTasks(
  tasks: readonly FinancialWorkerTask[],
  onError: (name: string, error: unknown) => void,
) {
  for (const task of tasks) {
    try {
      await task.run();
    } catch (error) {
      onError(task.name, error);
    }
  }
}
