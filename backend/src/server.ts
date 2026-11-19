import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

dotenv.config();

const app = express();
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;

interface AuthenticatedRequest extends Request {
    customerId?: number;
    role?: string;
}

function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;

    if (!secret) {
        throw new Error('JWT_SECRET is not configured');
    }

    return secret;
}

// JWT AUTHENTICATION MIDDLEWARE

const authenticateToken = async (
    req: Request,
    res: Response,
    next: NextFunction
): Promise<void> => {

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
            success: false,
            message: 'Authentication token required'
        });
        return;
    }

    let customerId: number;

    try {
        const decoded = jwt.verify(
            authHeader.substring(7),
            getJwtSecret()
        );

        if (
            typeof decoded === 'string' ||
            !Number.isInteger(decoded.customerId)
        ) {
            res.status(401).json({
                success: false,
                message: 'Invalid authentication token'
            });
            return;
        }

        customerId = decoded.customerId as number;

    } catch {
        res.status(401).json({
            success: false,
            message: 'Invalid or expired authentication token'
        });
        return;
    }

    try {
        const customer = await prisma.customer.findUnique({
            where: {
                id: customerId
            },
            select: {
                id: true,
                role: true
            }
        });

        if (!customer) {
            res.status(401).json({
                success: false,
                message: 'Customer account not found'
            });
            return;
        }

        const authenticatedRequest = req as AuthenticatedRequest;

        authenticatedRequest.customerId = customer.id;
        authenticatedRequest.role = customer.role;

        next();

    } catch (error) {
        console.error('Authentication database error:', error);

        res.status(500).json({
            success: false,
            message: 'Authentication service unavailable'
        });
    }
};

// ADMIN AUTHORIZATION MIDDLEWARE

const requireAdmin = (
    req: Request,
    res: Response,
    next: NextFunction
): void => {

    const authenticatedRequest = req as AuthenticatedRequest;

    if (authenticatedRequest.role !== 'ADMIN') {
        res.status(403).json({
            success: false,
            message: 'Admin access required'
        });
        return;
    }

    next();
};

// HEALTH CHECK

app.get('/health', (req, res) => {
    res.json({
        status: 'Healthy',
        application: 'ShopSphere Backend'
    });
});

// CUSTOMER REGISTRATION

app.post('/api/auth/register', async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            typeof email !== 'string' ||
            !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()) ||
            typeof password !== 'string' ||
            password.length < 8
        ) {
            res.status(400).json({
                success: false,
                message: 'Valid name, email and password (minimum 8 characters) are required'
            });
            return;
        }

        const normalizedEmail = email.trim().toLowerCase();

        const existingCustomer = await prisma.customer.findUnique({
            where: {
                email: normalizedEmail
            }
        });

        if (existingCustomer) {
            res.status(409).json({
                success: false,
                message: 'Email is already registered'
            });
            return;
        }

        const passwordHash = await bcrypt.hash(password, 12);

        const customer = await prisma.customer.create({
            data: {
                name: name.trim(),
                email: normalizedEmail,
                passwordHash
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        });

        res.status(201).json({
            success: true,
            message: 'Customer registered successfully',
            customer
        });

    } catch (error) {
        console.error('Registration error:', error);

        res.status(500).json({
            success: false,
            message: 'Registration failed'
        });
    }
});

// CUSTOMER LOGIN

app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        if (
            typeof email !== 'string' ||
            typeof password !== 'string' ||
            !email.trim() ||
            !password
        ) {
            res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
            return;
        }

        const customer = await prisma.customer.findUnique({
            where: {
                email: email.trim().toLowerCase()
            }
        });

        if (!customer) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
            return;
        }

        const passwordMatches = await bcrypt.compare(
            password,
            customer.passwordHash
        );

        if (!passwordMatches) {
            res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
            return;
        }

        const token = jwt.sign(
            { customerId: customer.id },
            getJwtSecret(),
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Login successful',
            token,
            customer: {
                id: customer.id,
                name: customer.name,
                email: customer.email,
                role: customer.role
            }
        });

    } catch (error) {
        console.error('Login error:', error);

        res.status(500).json({
            success: false,
            message: 'Login failed'
        });
    }
});

// CUSTOMER PROFILE

app.get('/api/auth/profile', authenticateToken, async (req, res) => {
    try {
        const customerId = (req as AuthenticatedRequest).customerId!;

        const customer = await prisma.customer.findUnique({
            where: {
                id: customerId
            },
            select: {
                id: true,
                name: true,
                email: true,
                role: true,
                createdAt: true
            }
        });

        if (!customer) {
            res.status(404).json({
                success: false,
                message: 'Customer not found'
            });
            return;
        }

        res.json({
            success: true,
            customer
        });

    } catch (error) {
        console.error('Profile error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer profile'
        });
    }
});

// CUSTOMER ORDER HISTORY

app.get('/api/my/orders', authenticateToken, async (req, res) => {
    try {
        const customerId = (req as AuthenticatedRequest).customerId!;

        const orders = await prisma.order.findMany({
            where: {
                customerId
            },
            orderBy: {
                createdAt: 'desc'
            },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        res.json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {
        console.error('Customer orders error:', error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch customer orders'
        });
    }
});

// GET ALL PRODUCTS - PUBLIC

app.get('/api/products', async (req, res) => {
    try {
        const products = await prisma.product.findMany({
            orderBy: {
                id: 'desc'
            }
        });

        res.json({
            success: true,
            products
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch products'
        });
    }
});

// ADD NEW PRODUCT - ADMIN ONLY

app.post('/api/products', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const {
            name,
            description,
            price,
            category,
            imageUrl
        } = req.body;

        if (
            typeof name !== 'string' ||
            !name.trim() ||
            price === undefined ||
            !Number.isFinite(Number(price)) ||
            Number(price) <= 0 ||
            (category !== undefined && typeof category !== 'string') ||
            (imageUrl !== undefined &&
                imageUrl !== null &&
                typeof imageUrl !== 'string')
        ) {
            res.status(400).json({
                success: false,
                message: 'Valid product details are required'
            });
            return;
        }

        const product = await prisma.product.create({
            data: {
                name: name.trim(),
                description: description || null,
                price: Number(price),
                category: category?.trim() || 'General',
                imageUrl: imageUrl?.trim() || null
            }
        });

        res.status(201).json({
            success: true,
            message: 'Product added successfully',
            product
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Failed to create product'
        });
    }
});

// UPDATE PRODUCT IMAGE - ADMIN ONLY

app.put('/api/products/:id/image', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const productId = Number(req.params.id);
        const { imageUrl } = req.body;

        if (
            !Number.isInteger(productId) ||
            productId <= 0 ||
            typeof imageUrl !== 'string' ||
            !/^https?:\/\/.+/.test(imageUrl.trim())
        ) {
            res.status(400).json({
                success: false,
                message: 'Valid product ID and image URL are required'
            });
            return;
        }

        const product = await prisma.product.update({
            where: {
                id: productId
            },
            data: {
                imageUrl: imageUrl.trim()
            }
        });

        res.json({
            success: true,
            message: 'Product image updated successfully',
            product
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Failed to update product image'
        });
    }
});

// CREATE CUSTOMER ORDER

app.post('/api/orders', async (req, res) => {
    try {
        const {
            customerName,
            customerEmail,
            items
        } = req.body;

        if (!Array.isArray(items) || items.length === 0) {
            res.status(400).json({
                success: false,
                message: 'Cart items are required'
            });
            return;
        }

        // Support both guest checkout and logged-in checkout.

        let authenticatedCustomer: {
            id: number;
            name: string;
            email: string;
        } | null = null;

        const authHeader = req.headers.authorization;

        if (authHeader) {
            if (!authHeader.startsWith('Bearer ')) {
                res.status(401).json({
                    success: false,
                    message: 'Invalid authentication header'
                });
                return;
            }

            try {
                const decoded = jwt.verify(
                    authHeader.substring(7),
                    getJwtSecret()
                );

                if (
                    typeof decoded === 'string' ||
                    !Number.isInteger(decoded.customerId)
                ) {
                    res.status(401).json({
                        success: false,
                        message: 'Invalid authentication token'
                    });
                    return;
                }

                authenticatedCustomer = await prisma.customer.findUnique({
                    where: {
                        id: decoded.customerId as number
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true
                    }
                });

                if (!authenticatedCustomer) {
                    res.status(401).json({
                        success: false,
                        message: 'Customer account not found'
                    });
                    return;
                }

            } catch {
                res.status(401).json({
                    success: false,
                    message: 'Invalid or expired authentication token'
                });
                return;
            }
        }

        if (
            !authenticatedCustomer &&
            (
                typeof customerName !== 'string' ||
                !customerName.trim() ||
                typeof customerEmail !== 'string' ||
                !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail.trim())
            )
        ) {
            res.status(400).json({
                success: false,
                message: 'Valid customer details are required'
            });
            return;
        }

        const order = await prisma.$transaction(async (tx) => {
            let totalAmount = 0;

            const orderItems: {
                productId: number;
                quantity: number;
                price: number;
            }[] = [];

            for (const item of items) {
                const productId = Number(item.productId);
                const quantity = Number(item.quantity);

                if (
                    !Number.isInteger(productId) ||
                    !Number.isInteger(quantity) ||
                    productId <= 0 ||
                    quantity <= 0
                ) {
                    throw new Error('INVALID_ORDER_ITEM');
                }

                const product = await tx.product.findUnique({
                    where: {
                        id: productId
                    }
                });

                if (!product) {
                    throw new Error('INVALID_ORDER_ITEM');
                }

                totalAmount += product.price * quantity;

                orderItems.push({
                    productId: product.id,
                    quantity,
                    price: product.price
                });
            }

            return tx.order.create({
                data: {
                    customerId: authenticatedCustomer?.id ?? null,

                    customerName: authenticatedCustomer
                        ? authenticatedCustomer.name
                        : customerName.trim(),

                    customerEmail: authenticatedCustomer
                        ? authenticatedCustomer.email
                        : customerEmail.trim().toLowerCase(),

                    totalAmount,
                    status: 'PENDING',

                    items: {
                        create: orderItems
                    }
                },
                include: {
                    items: true
                }
            });
        });

        const paymentToken = authenticatedCustomer
            ? null
            : jwt.sign(
                {
                    orderId: order.id,
                    purpose: 'guest-mock-payment'
                },
                getJwtSecret(),
                { expiresIn: '30m' }
            );

        res.status(201).json({
            success: true,
            message: 'Order placed successfully',
            order,
            paymentToken
        });

    } catch (error) {
        console.error(error);

        if (
            error instanceof Error &&
            error.message === 'INVALID_ORDER_ITEM'
        ) {
            res.status(400).json({
                success: false,
                message: 'Invalid product or quantity'
            });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Failed to place order'
        });
    }
});

// MOCK PAYMENT - DEMO ONLY

app.post('/api/orders/:id/mock-payment', async (req, res) => {
    try {
        const orderId = Number(req.params.id);
        const { outcome, paymentToken } = req.body;

        if (!Number.isInteger(orderId) || orderId <= 0) {
            res.status(400).json({
                success: false,
                message: 'Invalid order ID'
            });
            return;
        }

        if (!['SUCCESS', 'FAILURE'].includes(outcome)) {
            res.status(400).json({
                success: false,
                message: 'Invalid demo payment outcome'
            });
            return;
        }

        let customerId: number | null = null;
        const authHeader = req.headers.authorization;

        if (authHeader) {
            if (!authHeader.startsWith('Bearer ')) {
                res.status(401).json({
                    success: false,
                    message: 'Invalid authentication header'
                });
                return;
            }

            try {
                const decoded = jwt.verify(
                    authHeader.substring(7),
                    getJwtSecret()
                );

                if (
                    typeof decoded === 'string' ||
                    !Number.isInteger(decoded.customerId)
                ) {
                    res.status(401).json({
                        success: false,
                        message: 'Invalid authentication token'
                    });
                    return;
                }

                customerId = decoded.customerId as number;

            } catch {
                res.status(401).json({
                    success: false,
                    message: 'Invalid or expired authentication token'
                });
                return;
            }
        }

        const existingOrder = await prisma.order.findUnique({
            where: { id: orderId },
            select: {
                id: true,
                customerId: true,
                status: true,
                paymentStatus: true
            }
        });

        if (!existingOrder) {
            res.status(404).json({
                success: false,
                message: 'Order not found'
            });
            return;
        }

        if (customerId !== null) {
            if (existingOrder.customerId !== customerId) {
                res.status(403).json({
                    success: false,
                    message: 'You cannot pay for this order'
                });
                return;
            }
        } else {
            if (typeof paymentToken !== 'string') {
                res.status(401).json({
                    success: false,
                    message: 'Guest payment token required'
                });
                return;
            }

            try {
                const decoded = jwt.verify(
                    paymentToken,
                    getJwtSecret()
                );

                if (
                    typeof decoded === 'string' ||
                    decoded.purpose !== 'guest-mock-payment' ||
                    decoded.orderId !== orderId
                ) {
                    res.status(401).json({
                        success: false,
                        message: 'Invalid guest payment token'
                    });
                    return;
                }

            } catch {
                res.status(401).json({
                    success: false,
                    message: 'Invalid or expired guest payment token'
                });
                return;
            }

            if (existingOrder.customerId !== null) {
                res.status(403).json({
                    success: false,
                    message: 'Guest payment is not allowed for this order'
                });
                return;
            }
        }

        if (
            existingOrder.status !== 'PENDING' ||
            existingOrder.paymentStatus !== null
        ) {
            res.status(409).json({
                success: false,
                message: 'This order cannot be paid again'
            });
            return;
        }

        const result = await prisma.order.updateMany({
            where: {
                id: orderId,
                status: 'PENDING',
                paymentStatus: null,
                customerId
            },
            data: {
                paymentStatus: outcome === 'SUCCESS' ? 'PAID' : 'FAILED'
            }
        });

        if (result.count === 0) {
            res.status(409).json({
                success: false,
                message: 'Payment was already processed'
            });
            return;
        }

        const updatedOrder = await prisma.order.findUnique({
            where: { id: orderId },
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        res.json({
            success: true,
            message: outcome === 'SUCCESS'
                ? 'Demo payment successful'
                : 'Demo payment failed',
            order: updatedOrder
        });

    } catch (error) {
        console.error('Mock payment error:', error);

        res.status(500).json({
            success: false,
            message: 'Mock payment processing failed'
        });
    }
});
// ADMIN DASHBOARD API

app.get('/api/admin/dashboard', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const [
            totalOrders,
            totalOrderValue,
            totalCustomers,
            totalProducts,
            recentOrders
        ] = await Promise.all([
            prisma.order.count(),
            prisma.order.aggregate({
                _sum: { totalAmount: true }
            }),
            prisma.customer.count({
                where: { role: 'CUSTOMER' }
            }),
            prisma.product.count(),
            prisma.order.findMany({
                orderBy: { createdAt: 'desc' },
                take: 5,
                include: {
                    items: {
                        include: {
                            product: true
                        }
                    }
                }
            })
        ]);

        res.json({
            success: true,
            stats: {
                totalOrders,
                totalOrderValue: totalOrderValue._sum.totalAmount || 0,
                totalCustomers,
                totalProducts
            },
            recentOrders
        });

    } catch (error) {
        console.error('Admin dashboard error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load admin dashboard'
        });
    }
});
// GET ALL ORDERS - ADMIN ONLY

app.get('/api/orders', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const orders = await prisma.order.findMany({
            orderBy: {
                createdAt: 'desc'
            },
            take: 50,
            include: {
                items: {
                    include: {
                        product: true
                    }
                }
            }
        });

        res.json({
            success: true,
            count: orders.length,
            orders
        });

    } catch (error) {
        console.error(error);

        res.status(500).json({
            success: false,
            message: 'Failed to fetch orders'
        });
    }
});


// UPDATE ORDER STATUS - ADMIN ONLY

app.put('/api/orders/:id/status', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);
        const { status } = req.body;

        const allowedStatuses = [
            'PENDING',
            'PROCESSING',
            'SHIPPED',
            'DELIVERED',
            'CANCELLED'
        ];

        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ success: false, message: 'Invalid order ID' });
            return;
        }

        if (!allowedStatuses.includes(status)) {
            res.status(400).json({ success: false, message: 'Invalid order status' });
            return;
        }

        const existingOrder = await prisma.order.findUnique({
            where: { id },
            select: {
                id: true,
                paymentStatus: true
            }
        });

        if (!existingOrder) {
            res.status(404).json({
                success: false,
                message: 'Order not found'
            });
            return;
        }

        const fulfillmentStatuses = [
            'PROCESSING',
            'SHIPPED',
            'DELIVERED'
        ];

        if (
            existingOrder.paymentStatus === 'FAILED' &&
            fulfillmentStatuses.includes(status)
        ) {
            res.status(400).json({
                success: false,
                message: 'Cannot process this order because payment has failed.'
            });
            return;
        }

        const updatedOrder = await prisma.order.update({
            where: { id },
            data: { status },
            include: {
                items: {
                    include: { product: true }
                }
            }
        });

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order: updatedOrder
        });

    } catch (error: any) {
        console.error('Order status update error:', error);

        if (error.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Order not found' });
            return;
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update order status'
        });
    }
});

// UPDATE PRODUCT - ADMIN ONLY

app.put('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ success: false, message: 'Invalid product ID' });
            return;
        }

        const { name, description, price, category, imageUrl } = req.body;

        const data: {
            name?: string;
            description?: string | null;
            price?: number;
            category?: string;
            imageUrl?: string | null;
        } = {};

        if (name !== undefined) {
            if (typeof name !== 'string' || !name.trim()) {
                res.status(400).json({ success: false, message: 'Invalid product name' });
                return;
            }
            data.name = name.trim();
        }

        if (description !== undefined) {
            if (description !== null && typeof description !== 'string') {
                res.status(400).json({ success: false, message: 'Invalid description' });
                return;
            }
            data.description = description;
        }

        if (price !== undefined) {
            const parsedPrice = Number(price);
            if (!Number.isFinite(parsedPrice) || parsedPrice <= 0) {
                res.status(400).json({ success: false, message: 'Price must be greater than zero' });
                return;
            }
            data.price = parsedPrice;
        }

        if (category !== undefined) {
            if (typeof category !== 'string' || !category.trim()) {
                res.status(400).json({ success: false, message: 'Invalid category' });
                return;
            }
            data.category = category.trim();
        }

        if (imageUrl !== undefined) {
            if (imageUrl !== null && typeof imageUrl !== 'string') {
                res.status(400).json({ success: false, message: 'Invalid image URL' });
                return;
            }
            data.imageUrl = imageUrl;
        }

        if (Object.keys(data).length === 0) {
            res.status(400).json({ success: false, message: 'No product details provided' });
            return;
        }

        const product = await prisma.product.update({
            where: { id },
            data
        });

        res.json({
            success: true,
            message: 'Product updated successfully',
            product
        });

    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }

        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to update product' });
    }
});

// DELETE PRODUCT - ADMIN ONLY

app.delete('/api/products/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            res.status(400).json({ success: false, message: 'Invalid product ID' });
            return;
        }

        const product = await prisma.product.findUnique({
            where: { id }
        });

        if (!product) {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }

        const existingOrderItems = await prisma.orderItem.count({
            where: { productId: id }
        });

        if (existingOrderItems > 0) {
            res.status(409).json({
                success: false,
                message: 'This product is linked to existing orders and cannot be deleted'
            });
            return;
        }

        await prisma.product.delete({
            where: { id }
        });

        res.json({
            success: true,
            message: 'Product deleted successfully'
        });

    } catch (error: any) {
        if (error?.code === 'P2025') {
            res.status(404).json({ success: false, message: 'Product not found' });
            return;
        }

        if (error?.code === 'P2003') {
            res.status(409).json({
                success: false,
                message: 'Product is linked to an existing order and cannot be deleted'
            });
            return;
        }

        console.error(error);
        res.status(500).json({ success: false, message: 'Failed to delete product' });
    }
});

// START SERVER

app.listen(PORT, () => {
    console.log(`ShopSphere Backend running on port ${PORT}`);
});


