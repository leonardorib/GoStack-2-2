import AppError from '../errors/AppError';
import TransactionsRepository from '../repositories/TransactionsRepository';
import { getCustomRepository } from 'typeorm';
interface Request {
  id: string;
}

class DeleteTransactionService {
  public async execute({ id }: Request): Promise<void> {
    const transactionsRepository = getCustomRepository(TransactionsRepository);

    // Searches for the transaction in database
    const transaction = await transactionsRepository.findOne({ id });

    // If doesn't find it, returns an error
    if (!transaction) {
      throw new AppError('Transaction does not exist');
    }

    // Deletes transaction
    await transactionsRepository.remove(transaction);
  }
}

export default DeleteTransactionService;
