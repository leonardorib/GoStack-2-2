import { EntityRepository, Repository, getRepository } from 'typeorm';

import Transaction from '../models/Transaction';

interface Balance {
  income: number;
  outcome: number;
  total: number;
}

@EntityRepository(Transaction)
class TransactionsRepository extends Repository<Transaction> {
  public async getBalance(): Promise<Balance> {
    const transactionsRepository = getRepository(Transaction);

    // Gets all transactions
    const transactions = await transactionsRepository.find();

    // Sum values of all income transactions
    const income = transactions.reduce(
      (income, transaction, index, transactions) =>
        transaction.type === 'income' ? income + transaction.value : income,
      0,
    );

    // Sum values of all outcome transactions
    const outcome = transactions.reduce(
      (outcome, transaction, index, transactions) =>
        transaction.type === 'outcome' ? outcome + transaction.value : outcome,
      0,
    );

    const total = income - outcome;

    return { income, outcome, total };
  }
}

export default TransactionsRepository;
