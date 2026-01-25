/**
 * GOPANG 거래 API
 */

import { Router, Request, Response } from 'express';
import tradingService from '../services/trading';

const router = Router();

// 상품 목록
router.get('/products', (req: Request, res: Response) => {
  const categoryParam = req.query.category;
  const category = typeof categoryParam === 'string' ? categoryParam : undefined;
  const products = tradingService.getProducts(category);

  res.json({
    success: true,
    count: products.length,
    categories: [...new Set(products.map(p => p.category))],
    products
  });
});

// 상품 상세
router.get('/products/:id', (req: Request, res: Response) => {
  const productId = String(req.params.id);
  const product = tradingService.getProduct(productId);

  if (!product) {
    res.status(404).json({ success: false, error: '상품을 찾을 수 없습니다.' });
    return;
  }

  res.json({ success: true, product });
});

// 주문 생성
router.post('/orders', async (req: Request, res: Response) => {
  try {
    const { buyerId, items } = req.body;

    if (!buyerId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        success: false,
        error: 'buyerId와 items 배열이 필요합니다.',
        example: {
          buyerId: 'SGP-JM-01',
          items: [{ productId: 'PROD-0001', quantity: 2 }]
        }
      });
      return;
    }

    const result = await tradingService.createOrder(buyerId, items);

    res.status(result.success ? 201 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 주문 조회
router.get('/orders/:id', (req: Request, res: Response) => {
  const orderId = String(req.params.id);
  const order = tradingService.getOrder(orderId);

  if (!order) {
    res.status(404).json({ success: false, error: '주문을 찾을 수 없습니다.' });
    return;
  }

  res.json({ success: true, order });
});

// 사용자 주문 목록
router.get('/orders/user/:id', (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const orders = tradingService.getUserOrders(userId);

  res.json({
    success: true,
    userId,
    count: orders.length,
    orders
  });
});

// 재무제표 조회
router.get('/financial/:id', (req: Request, res: Response) => {
  const userId = String(req.params.id);
  const statement = tradingService.getFinancialStatement(userId);

  if (!statement) {
    res.status(404).json({ success: false, error: '사용자를 찾을 수 없습니다.' });
    return;
  }

  res.json({ success: true, ...statement });
});

// 상품 추가 (판매자용)
router.post('/products', (req: Request, res: Response) => {
  try {
    const { name, category, price, cost, sellerId, sellerName, stock, unit, origin } = req.body;

    if (!name || !category || !price || !sellerId || !stock) {
      res.status(400).json({
        success: false,
        error: 'name, category, price, sellerId, stock이 필요합니다.'
      });
      return;
    }

    const product = tradingService.addProduct({
      name,
      category,
      price,
      cost: cost || Math.floor(price * 0.6),
      sellerId,
      sellerName: sellerName || sellerId,
      stock,
      unit: unit || '개',
      origin
    });

    res.status(201).json({ success: true, product });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 카테고리 목록
router.get('/categories', (req: Request, res: Response) => {
  const products = tradingService.getProducts();
  const categories = [...new Set(products.map(p => p.category))];

  const stats = categories.map(cat => ({
    name: cat,
    count: products.filter(p => p.category === cat).length,
    totalStock: products.filter(p => p.category === cat).reduce((sum, p) => sum + p.stock, 0)
  }));

  res.json({ success: true, categories: stats });
});

export default router;
