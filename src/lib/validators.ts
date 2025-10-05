import { z } from 'zod';

export const ItemCreate = z.object({
  name: z.string().min(1),
  type: z.string().optional(),
  price: z.number().int().nonnegative(),
  stock: z.number().int().nonnegative().default(0),
});

export const OrderCreate = z.object({
  customer: z.object({
    id: z.string().optional(),
    name: z.string().optional(),
    address: z.string().optional(),
    whatsapp: z.string().optional(),
  }).optional(),
  items: z.array(z.object({ itemId: z.string(), qty: z.number().int().positive() })),
  discount: z.number().int().nonnegative().optional(),
  paymentType: z.enum(['CASH','TRANSFER','QRIS']).optional(),
});
