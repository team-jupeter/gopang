/**
 * GOPANG 거래 서비스
 * 상품 매매 → 재무제표 실시간 반영
 * 
 * 【거래 흐름】
 * 1. 구매자가 상품 주문
 * 2. 오픈해시에 거래 기록
 * 3. 양측 재무제표 업데이트
 *    - 판매자: 매출 증가, 재고 감소, 현금 증가
 *    - 구매자: 재고 증가 (또는 비용), 현금 감소
 * 4. 거래 확정
 */

import fs from 'fs';
import path from 'path';
import axios from 'axios';
import crypto from 'crypto';

// SHA-256 해싱
function sha256(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex');
}

// ============================================================================
// 데이터 타입
// ============================================================================

interface Product {
  id: string;
  name: string;
  category: string;
  price: number;
  cost: number;           // 원가
  sellerId: string;
  sellerName: string;
  stock: number;
  unit: string;
  description?: string;
  origin?: string;        // 원산지
  createdAt: string;
}

interface OrderItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface Order {
  orderId: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  items: OrderItem[];
  totalAmount: number;
  status: 'PENDING' | 'CONFIRMED' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';
  openHashTxId?: string;
  openHashLayer?: number;
  createdAt: string;
  updatedAt: string;
}

interface FinancialImpact {
  userId: string;
  changes: {
    cash: number;
    inventory: number;
    receivables: number;
    payables: number;
    revenue: number;
    costOfSales: number;
  };
}

interface TradeResult {
  success: boolean;
  orderId?: string;
  openHashTxId?: string;
  openHashLayer?: number;
  financialImpacts?: FinancialImpact[];
  error?: string;
}

// ============================================================================
// 오픈해시 노드 설정
// ============================================================================

const OPENHASH_NODES = {
  'KR': { url: 'http://3.231.220.126:5001', layer: 4 },
  'KR-JEJU': { url: 'http://3.231.220.126:5002', layer: 3 },
  'KR-JEJU-SEOGWIPO': { url: 'http://3.231.220.126:5003', layer: 2 },
  'KR-JEJU-SEOGWIPO-JM': { url: 'http://3.231.220.126:5004', layer: 1 }
};

// ============================================================================
// 거래 서비스
// ============================================================================

class TradingService {
  private users: Map<string, any> = new Map();
  private products: Map<string, Product> = new Map();
  private orders: Map<string, Order> = new Map();

  constructor() {
    this.loadUsers();
    this.initializeProducts();
  }

  private loadUsers(): void {
    try {
      const dataDir = '/gopang/frontend/data';
      
      ['users-registry.json', 'users-jeju-city.json'].forEach(file => {
        const filePath = path.join(dataDir, file);
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
          data.users.forEach((user: any) => {
            this.users.set(user.userId, user);
            this.users.set(user.loginId, user);
          });
        }
      });
      
      console.log(`[Trading] Loaded ${this.users.size / 2} users`);
    } catch (error) {
      console.error('[Trading] Failed to load users:', error);
    }
  }

  /**
   * 제주 특산품 초기화
   */
  private initializeProducts(): void {
    const jejuProducts: Omit<Product, 'id' | 'createdAt'>[] = [
      // 농산물
      { name: '한라봉', category: '농산물', price: 30000, cost: 20000, sellerId: 'SGP-DJ-01', sellerName: '대정읍농업1호', stock: 100, unit: '5kg', origin: '서귀포시 대정읍' },
      { name: '감귤', category: '농산물', price: 15000, cost: 10000, sellerId: 'SGP-NW-01', sellerName: '남원읍농업1호', stock: 200, unit: '10kg', origin: '서귀포시 남원읍' },
      { name: '천혜향', category: '농산물', price: 35000, cost: 25000, sellerId: 'SGP-SS-01', sellerName: '성산읍농업1호', stock: 80, unit: '3kg', origin: '서귀포시 성산읍' },
      { name: '레드향', category: '농산물', price: 40000, cost: 28000, sellerId: 'SGP-AD-01', sellerName: '안덕면농업1호', stock: 60, unit: '3kg', origin: '서귀포시 안덕면' },
      { name: '당근', category: '농산물', price: 8000, cost: 5000, sellerId: 'SGP-PS-01', sellerName: '표선면농업1호', stock: 150, unit: '3kg', origin: '서귀포시 표선면' },
      
      // 수산물
      { name: '옥돔', category: '수산물', price: 50000, cost: 35000, sellerId: 'SGP-JM-02', sellerName: '중문동어업2호', stock: 30, unit: '1kg', origin: '서귀포시 중문동' },
      { name: '갈치', category: '수산물', price: 45000, cost: 30000, sellerId: 'SGP-SSD-02', sellerName: '송산동어업2호', stock: 40, unit: '1kg', origin: '서귀포시 송산동' },
      { name: '고등어', category: '수산물', price: 20000, cost: 12000, sellerId: 'SGP-JB-02', sellerName: '정방동어업2호', stock: 80, unit: '2kg', origin: '서귀포시 정방동' },
      { name: '전복', category: '수산물', price: 80000, cost: 55000, sellerId: 'SGP-CJ-02', sellerName: '천지동어업2호', stock: 25, unit: '1kg', origin: '서귀포시 천지동' },
      
      // 가공식품
      { name: '감귤초콜릿', category: '가공식품', price: 12000, cost: 7000, sellerId: 'SGP-JA-03', sellerName: '중앙동제조3호', stock: 200, unit: '200g', origin: '서귀포시' },
      { name: '한라봉잼', category: '가공식품', price: 15000, cost: 9000, sellerId: 'SGP-HD-03', sellerName: '효돈동제조3호', stock: 100, unit: '500g', origin: '서귀포시' },
      { name: '흑돼지소시지', category: '가공식품', price: 25000, cost: 16000, sellerId: 'SGP-YC-03', sellerName: '영천동제조3호', stock: 80, unit: '500g', origin: '서귀포시' },
      
      // 숙박/서비스
      { name: '펜션1박', category: '숙박', price: 150000, cost: 80000, sellerId: 'SGP-JM-06', sellerName: '중문동숙박6호', stock: 10, unit: '1박', origin: '서귀포시 중문동' },
      { name: '렌터카1일', category: '서비스', price: 50000, cost: 30000, sellerId: 'SGP-JM-08', sellerName: '중문동운수8호', stock: 20, unit: '1일', origin: '서귀포시' },
    ];

    jejuProducts.forEach((p, idx) => {
      const product: Product = {
        ...p,
        id: `PROD-${String(idx + 1).padStart(4, '0')}`,
        createdAt: new Date().toISOString()
      };
      this.products.set(product.id, product);
    });

    console.log(`[Trading] Initialized ${this.products.size} products`);
  }

  /**
   * 상품 목록 조회
   */
  getProducts(category?: string): Product[] {
    const products = Array.from(this.products.values());
    if (category) {
      return products.filter(p => p.category === category);
    }
    return products;
  }

  /**
   * 상품 상세 조회
   */
  getProduct(productId: string): Product | undefined {
    return this.products.get(productId);
  }

  /**
   * 주문 생성 및 거래 실행
   */
  async createOrder(
    buyerId: string,
    items: { productId: string; quantity: number }[]
  ): Promise<TradeResult> {
    
    // 1. 구매자 확인
    const buyer = this.users.get(buyerId);
    if (!buyer) {
      return { success: false, error: '구매자를 찾을 수 없습니다.' };
    }

    // 2. 상품 및 재고 확인
    const orderItems: OrderItem[] = [];
    let totalAmount = 0;
    const sellers: Map<string, any> = new Map();

    for (const item of items) {
      const product = this.products.get(item.productId);
      if (!product) {
        return { success: false, error: `상품을 찾을 수 없습니다: ${item.productId}` };
      }
      if (product.stock < item.quantity) {
        return { success: false, error: `재고 부족: ${product.name} (재고: ${product.stock})` };
      }

      const itemTotal = product.price * item.quantity;
      orderItems.push({
        productId: product.id,
        productName: product.name,
        quantity: item.quantity,
        unitPrice: product.price,
        totalPrice: itemTotal
      });
      totalAmount += itemTotal;

      // 판매자 정보 수집
      if (!sellers.has(product.sellerId)) {
        const seller = this.users.get(product.sellerId);
        if (seller) {
          sellers.set(product.sellerId, { seller, products: [] });
        }
      }
      sellers.get(product.sellerId)?.products.push({ product, quantity: item.quantity });
    }

    // 3. 구매자 잔액 확인
    if (buyer.wallet.balance < totalAmount) {
      return { success: false, error: `잔액 부족: ${buyer.wallet.balance} < ${totalAmount}` };
    }

    // 4. 주문 생성
    const orderId = `ORD-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const timestamp = new Date().toISOString();

    // 5. 오픈해시에 거래 기록
    let openHashResult: any = null;
    try {
      // 확률적 계층 선택 (구매자 위치 기반)
      const layerId = buyer.location.district || 'KR-JEJU-SEOGWIPO-JM';
      const nodeConfig = OPENHASH_NODES[layerId as keyof typeof OPENHASH_NODES] || OPENHASH_NODES['KR-JEJU-SEOGWIPO-JM'];

      openHashResult = await axios.post(`${nodeConfig.url}/transaction`, {
        sender: buyerId,
        receiver: Array.from(sellers.keys()).join(','),
        amount: totalAmount,
        data: {
          type: 'PURCHASE_ORDER',
          orderId,
          items: orderItems.map(i => ({ id: i.productId, qty: i.quantity })),
          timestamp
        }
      }, { timeout: 5000 });

    } catch (error: any) {
      console.log(`[Trading] OpenHash recording failed: ${error.message}`);
    }

    // 6. 재무제표 업데이트
    const financialImpacts: FinancialImpact[] = [];

    // 구매자 재무제표 업데이트
    buyer.wallet.balance -= totalAmount;
    if (buyer.financialStatement) {
      buyer.financialStatement.balanceSheet.assets.current.cash -= totalAmount;
      // 재고로 인식 (상품 구매의 경우)
      buyer.financialStatement.balanceSheet.assets.current.inventory += totalAmount;
    }
    financialImpacts.push({
      userId: buyerId,
      changes: {
        cash: -totalAmount,
        inventory: totalAmount,
        receivables: 0,
        payables: 0,
        revenue: 0,
        costOfSales: 0
      }
    });

    // 판매자들 재무제표 업데이트
    for (const [sellerId, { seller, products }] of sellers) {
      let sellerRevenue = 0;
      let sellerCost = 0;

      for (const { product, quantity } of products) {
        const revenue = product.price * quantity;
        const cost = product.cost * quantity;
        sellerRevenue += revenue;
        sellerCost += cost;

        // 재고 감소
        product.stock -= quantity;
      }

      // 판매자 잔액 증가
      seller.wallet.balance += sellerRevenue;

      // 판매자 재무제표 업데이트
      if (seller.financialStatement) {
        seller.financialStatement.balanceSheet.assets.current.cash += sellerRevenue;
        seller.financialStatement.balanceSheet.assets.current.inventory -= sellerCost;
        seller.financialStatement.incomeStatement.revenue += sellerRevenue;
        seller.financialStatement.incomeStatement.costOfSales += sellerCost;
        seller.financialStatement.incomeStatement.netIncome += (sellerRevenue - sellerCost);
        seller.financialStatement.balanceSheet.equity.retainedEarnings += (sellerRevenue - sellerCost);
      }

      financialImpacts.push({
        userId: sellerId,
        changes: {
          cash: sellerRevenue,
          inventory: -sellerCost,
          receivables: 0,
          payables: 0,
          revenue: sellerRevenue,
          costOfSales: sellerCost
        }
      });
    }

    // 7. 주문 저장
    const order: Order = {
      orderId,
      buyerId: buyer.userId,
      buyerName: buyer.name,
      sellerId: Array.from(sellers.keys()).join(','),
      sellerName: Array.from(sellers.values()).map(s => s.seller.name).join(', '),
      items: orderItems,
      totalAmount,
      status: 'CONFIRMED',
      openHashTxId: openHashResult?.data?.txHash,
      openHashLayer: openHashResult?.data?.layer,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.orders.set(orderId, order);

    console.log(`[Trading] Order created: ${orderId}, Amount: ${totalAmount}, Buyer: ${buyer.name}`);

    return {
      success: true,
      orderId,
      openHashTxId: openHashResult?.data?.txHash,
      openHashLayer: openHashResult?.data?.layer,
      financialImpacts
    };
  }

  /**
   * 주문 조회
   */
  getOrder(orderId: string): Order | undefined {
    return this.orders.get(orderId);
  }

  /**
   * 사용자 주문 목록
   */
  getUserOrders(userId: string): Order[] {
    return Array.from(this.orders.values()).filter(
      o => o.buyerId === userId || o.sellerId.includes(userId)
    );
  }

  /**
   * 사용자 재무제표 조회
   */
  getFinancialStatement(userId: string): any {
    const user = this.users.get(userId);
    if (!user) return null;
    return {
      userId: user.userId,
      name: user.name,
      business: user.business,
      wallet: user.wallet,
      financialStatement: user.financialStatement
    };
  }

  /**
   * 상품 추가 (판매자용)
   */
  addProduct(product: Omit<Product, 'id' | 'createdAt'>): Product {
    const newProduct: Product = {
      ...product,
      id: `PROD-${String(this.products.size + 1).padStart(4, '0')}`,
      createdAt: new Date().toISOString()
    };
    this.products.set(newProduct.id, newProduct);
    return newProduct;
  }
}

export default new TradingService();
