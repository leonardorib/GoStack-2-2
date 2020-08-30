import Transaction from '../models/Transaction';
import csvParse from 'csv-parse';
import fs from 'fs';
import path from 'path';
import TransactionsRepository from '../repositories/TransactionsRepository';
import { getCustomRepository, getRepository, In, Not } from 'typeorm';
import AppError from '../errors/AppError';
import CreateTransactionService from '../services/CreateTransactionService';
import Category from '../models/Category';

interface Request {
  filename: string;
}

async function loadCSV(csvFilePath: string): Promise<any[]> {
  // Creates filesystem reading stream
  const readCSVStream = fs.createReadStream(csvFilePath);

  // Creates csvParse reading stream
  const parseStream = csvParse({
    from_line: 2,
    ltrim: true,
    rtrim: true,
  });

  // Uses pipe method to transfer data from readCSVStream to parseStream
  const parseCSV = readCSVStream.pipe(parseStream);

  // Initalizing lines array, each line is an array too
  const lines: any[] | PromiseLike<any[]> = [];

  // For each line readed, inserts data in the lines array
  parseCSV.on('data', line => {
    lines.push(line);
  });

  // Waits for the complete reading
  await new Promise(resolve => {
    parseCSV.on('end', resolve);
  });

  return lines;
}

class ImportTransactionsService {
  async execute({ filename }: Request): Promise<Transaction[]> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);
    const categoriesRepository = getRepository(Category);
    const createTransactionService = new CreateTransactionService();
    const csvPath = path.resolve(__dirname, '..', '..', 'tmp', filename);

    // Colunns in each line of data: [0]Title - [1]Type - [2]Value - [3]Category
    const data = await loadCSV(csvPath);

    const categoriesBeingImported: string[] = [];

    // Converts each line from array format to transaction object
    const transactionsToBeInserted = data.map(line => {
      const transactionToBeInserted = {
        title: line[0],
        type: line[1],
        value: Number(line[2]),
        category_title: line[3],
      };

      // Checks for invalid transaction values
      if (transactionToBeInserted.value <= 0) {
        throw new AppError('One of the transactions has an invalid value');
      }

      categoriesBeingImported.push(line[3]);

      return transactionToBeInserted;
    });

    // Checking if there is enough balance to insert transactions
    // Sum values of all income transactions
    const income = transactionsToBeInserted.reduce(
      (income, transaction, index, transactions) =>
        transaction.type === 'income' ? income + transaction.value : income,
      0,
    );
    // Sum values of all outcome transactions
    const outcome = transactionsToBeInserted.reduce(
      (outcome, transaction, index, transactions) =>
        transaction.type === 'outcome' ? outcome + transaction.value : outcome,
      0,
    );

    // Gets the current balance in the account
    const currentBalance = await transactionsRepository.getBalance();

    // If the sum of all transactions values considering the type (income or outcome)
    // results in an outcome, verifies if there is enough balance
    if (income - outcome < 0 && income - outcome > currentBalance.total) {
      throw new AppError('Not enough resources to make this transactions');
    }

    // Searches in the database categories that we are trying to import and already exists
    const alreadyExistsCategories = await categoriesRepository.find({
      where: {
        title: In(categoriesBeingImported),
      },
    });

    // Array with only the titles of the categories that already exists in database
    const alreadyExistsCategoriesTitles = alreadyExistsCategories.map(
      category => {
        return category.title;
      },
    );

    // Array with unique new category titles
    // First logical test is true when the category do not exist in database
    // Second test it's only to make sure the array we have unique values
    const newCategoriesTitles = categoriesBeingImported.filter(
      (category, index, array) => {
        return (
          !alreadyExistsCategoriesTitles.includes(category) &&
          array.indexOf(category) === index
        );
      },
    );

    // Usings the array with unique new categories titles to actually create instances of categories
    const newCategories = newCategoriesTitles.map(categoryTitle => {
      return categoriesRepository.create({ title: categoryTitle });
    });

    // Saving categories in database
    await categoriesRepository.save(newCategories);

    // All categories array
    const allCategories = [...alreadyExistsCategories, ...newCategories];

    // Creates transactions array
    const transactions = transactionsToBeInserted.map(transaction => {
      const { title, value, type, category_title } = transaction;

      // Searches for a category with the same title of the category title in transaction
      const categoryFound = allCategories.find(
        category => category.title === category_title,
      );

      // Makes sure that category_id is never undefined (typescript exigency)
      if (!categoryFound) {
        throw new AppError('Error finding category');
      }

      const category = categoryFound;

      // Returns the transaction instance created
      const transactionToBeCreated = {
        title,
        value,
        type,
        category_id: category.id,
      };
      return transactionsRepository.create(transactionToBeCreated);
    });

    // Saves all transactions in database
    await transactionsRepository.save(transactions);

    return transactions;
  }
}

export default ImportTransactionsService;
