import AppError from '../errors/AppError';

import Transaction from '../models/Transaction';
import TransactionsRepository from '../repositories/TransactionsRepository';

import Category from '../models/Category';
import { getRepository, getCustomRepository } from 'typeorm';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category_title: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category_title,
  }: Request): Promise<Transaction> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);

    // Checks if value is positive and greather than zero
    if (value <= 0) {
      throw new AppError('Invalid transaction value');
    }

    // Gets Balance
    const balance = await transactionsRepository.getBalance();

    // If it's an outcome transaction, checks if there's a valid balance
    if (type === 'outcome' && value > balance.total) {
      throw new AppError('Not enough resources to make an outcome transaction');
    }

    // Searches a category with the provided title in database
    let category = await categoriesRepository.findOne({
      title: category_title,
    });

    // If there is no such category, then creates it
    if (!category) {
      category = categoriesRepository.create({ title: category_title });
      await categoriesRepository.save(category);
    }

    // Creates transaction
    const transaction = transactionsRepository.create({
      title,
      type,
      value,
      category_id: category.id,
    });

    // Saves it in the database
    await transactionsRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
