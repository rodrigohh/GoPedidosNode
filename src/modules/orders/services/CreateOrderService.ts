import { inject, injectable } from 'tsyringe';

import AppError from '@shared/errors/AppError';

import IProductsRepository from '@modules/products/repositories/IProductsRepository';
import ICustomersRepository from '@modules/customers/repositories/ICustomersRepository';
import Order from '../infra/typeorm/entities/Order';
import IOrdersRepository from '../repositories/IOrdersRepository';

interface IProduct {
  id: string;
  quantity: number;
}

interface IRequest {
  customer_id: string;
  products: IProduct[];
}

@injectable()
class CreateOrderService {
  constructor(
    @inject('OrdersRepository')
    private ordersRepository: IOrdersRepository,
    @inject('ProductsRepository')
    private productsRepository: IProductsRepository,
    @inject('CustomersRepository')
    private customersRepository: ICustomersRepository,
  ) {}

  public async execute({ customer_id, products }: IRequest): Promise<Order> {
    const findCustomer = await this.customersRepository.findById(customer_id);

    if(!findCustomer){
      throw new AppError('Cliente não existe');
    }

    const findProducts = await this.productsRepository.findAllById(products);

    if(!findProducts.length){
      throw new AppError('Produto(s) não existe(m)');
    }

    const existentProductIds = findProducts.map(product => product.id);

    const inexistentProducts = products.filter(
      product => !existentProductIds.includes(product.id)
    );

    if (inexistentProducts.length){
      throw new AppError('Produto não existe: '+inexistentProducts[0].id);
    }

    const findProductsWithoutQuantityAvailable = products.filter(
      product => findProducts.filter(p => p.id === product.id)[0].quantity < product.quantity,
    );

    if (findProductsWithoutQuantityAvailable.length){
      throw new AppError('Quantidade inválida: '+findProductsWithoutQuantityAvailable[0].id);
    }

    const formattedProducts = products.map(product => ({
      product_id: product.id,
      quantity: product.quantity,
      price: findProducts.filter(p => p.id === product.id)[0].price
    }));

    const order = await this.ordersRepository.create({
      customer: findCustomer,
      products: formattedProducts
    });

    const {order_products} = order;

    const orderedProductQuantity = order_products.map(
      product => ({
        id: product.product_id,
        quantity: findProducts.filter(p => p.id === product.product_id)[0].quantity - product.quantity
      })
    );

    await this.productsRepository.updateQuantity(orderedProductQuantity);

    return order;

  }
}

export default CreateOrderService;
