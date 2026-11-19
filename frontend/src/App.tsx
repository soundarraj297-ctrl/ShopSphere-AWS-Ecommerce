import { useEffect, useState, type FormEvent } from 'react'
import './App.css'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000'
const TOKEN_KEY = 'shopsphere_token'

interface Customer {
  id: number
  name: string
  email: string
  createdAt?: string
  role: 'CUSTOMER' | 'ADMIN' | string
}

interface Product {
  id: number
  name: string
  description?: string | null
  price: number
  category: string
  imageUrl?: string | null
}

interface CartItem extends Product {
  quantity: number
}

interface OrderItem {
  id: number
  productId: number
  quantity: number
  price: number
  product: Product
}

interface Order {
  id: number
  customerName: string
  customerEmail: string
  totalAmount: number
  status: string
  paymentStatus?: string | null
  createdAt: string
  items: OrderItem[]
}

interface DashboardStats {
  totalOrders: number
  totalOrderValue: number
  totalCustomers: number
  totalProducts: number
}

interface DashboardResponse {
  success: boolean
  stats: DashboardStats
  recentOrders: Order[]
}

function App() {
  const [products, setProducts] = useState<Product[]>([])
  const [cart, setCart] = useState<CartItem[]>([])
  const [orders, setOrders] = useState<Order[]>([])
  const [dashboard, setDashboard] = useState<DashboardResponse | null>(null)
  const [dashboardLoading, setDashboardLoading] = useState(false)

  const [loading, setLoading] = useState(true)
  const [ordersLoading, setOrdersLoading] = useState(false)

  const [customer, setCustomer] = useState<Customer | null>(null)
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) || '')
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login')
  const [authLoading, setAuthLoading] = useState(false)

  const [authName, setAuthName] = useState('')
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [price, setPrice] = useState('')
  const [category, setCategory] = useState('Electronics')
  const [imageUrl, setImageUrl] = useState('')
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editCategory, setEditCategory] = useState('General')
  const [editImageUrl, setEditImageUrl] = useState('')
  const [editLoading, setEditLoading] = useState(false)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('All')

  const [message, setMessage] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerEmail, setCustomerEmail] = useState('')
  const [pendingPayment, setPendingPayment] = useState<{
    orderId: number
    paymentToken: string | null
  } | null>(null)
  const [paymentLoading, setPaymentLoading] = useState(false)

  const categories = [
    'Electronics',
    'Fashion',
    'Accessories',
    'Home & Living',
    'General'
  ]

  const authHeaders = (currentToken: string) => ({
    Authorization: `Bearer ${currentToken}`
  })

  // FETCH PRODUCTS
  const fetchProducts = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/products`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch products')
      }

      setProducts(data.products || [])
    } catch {
      setMessage('Unable to connect to backend')
    } finally {
      setLoading(false)
    }
  }

  // FETCH CUSTOMER ORDERS
  const fetchOrders = async (currentToken = token, currentRole = customer?.role) => {
    if (!currentToken) {
      setOrders([])
      return
    }

    setOrdersLoading(true)

    try {
      const ordersEndpoint = currentRole === 'ADMIN' ? '/api/orders' : '/api/my/orders'
      const response = await fetch(`${API_BASE_URL}${ordersEndpoint}`, {
        headers: authHeaders(currentToken)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to fetch your orders')
      }

      setOrders(data.orders || [])
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to fetch orders')
    } finally {
      setOrdersLoading(false)
    }
  }

  // FETCH ADMIN DASHBOARD
  const fetchAdminDashboard = async (currentToken = token) => {
    if (!currentToken) return

    setDashboardLoading(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/admin/dashboard`, {
        headers: authHeaders(currentToken)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to load dashboard')
      }

      setDashboard(data)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Dashboard loading failed')
    } finally {
      setDashboardLoading(false)
    }
  }


  // UPDATE ORDER STATUS - ADMIN ONLY
  const updateOrderStatus = async (orderId: number, status: string) => {
    if (!token || customer?.role !== 'ADMIN') return

    try {
      const response = await fetch(`${API_BASE_URL}/api/orders/${orderId}/status`, {
        method: 'PUT',
        headers: {
          ...authHeaders(token),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Failed to update order status')
      }

      setMessage(`Order #${orderId} status updated to ${status}`)
      await fetchOrders(token, customer.role)
      await fetchAdminDashboard(token)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Order status update failed')
    }
  }
  // RESTORE LOGIN SESSION
  const restoreSession = async (currentToken: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
        headers: authHeaders(currentToken)
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.message || 'Session expired')
      }

      setCustomer(data.customer)
      setCustomerName(data.customer.name)
      setCustomerEmail(data.customer.email)

      await fetchOrders(currentToken, data.customer.role)
    } catch {
      localStorage.removeItem(TOKEN_KEY)
      setToken('')
      setCustomer(null)
      setOrders([])
    }
  }

  useEffect(() => {
    fetchProducts()

    if (token) {
      restoreSession(token)
    }
  }, [])

  // LOAD DASHBOARD AFTER ADMIN LOGIN
  useEffect(() => {
    if (customer?.role === 'ADMIN' && token) {
      fetchAdminDashboard(token)
    } else {
      setDashboard(null)
    }
  }, [customer, token])

  // SEARCH AND CATEGORY FILTER
  const filteredProducts = products.filter(product => {
    const matchesSearch =
      product.name.toLowerCase().includes(search.toLowerCase()) ||
      (product.description || '').toLowerCase().includes(search.toLowerCase())

    const matchesCategory =
      selectedCategory === 'All' ||
      product.category === selectedCategory

    return matchesSearch && matchesCategory
  })

  // CUSTOMER REGISTRATION AND LOGIN
  const handleAuthentication = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (authMode === 'register' && !authName.trim()) {
      setMessage('Please enter your name')
      return
    }

    if (authPassword.length < 8) {
      setMessage('Password must contain at least 8 characters')
      return
    }

    setAuthLoading(true)

    try {
      const endpoint = authMode === 'register'
        ? '/api/auth/register'
        : '/api/auth/login'

      const body = authMode === 'register'
        ? {
            name: authName.trim(),
            email: authEmail.trim(),
            password: authPassword
          }
        : {
            email: authEmail.trim(),
            password: authPassword
          }

      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || 'Authentication failed')
      }

      if (authMode === 'register') {
        setMessage('Registration successful! Please login.')
        setAuthMode('login')
        setAuthPassword('')
        return
      }

      if (!data.token) {
        throw new Error('Login token was not received')
      }

      localStorage.setItem(TOKEN_KEY, data.token)
      setToken(data.token)
      setCustomer(data.customer)
      setCustomerName(data.customer.name)
      setCustomerEmail(data.customer.email)
      setAuthPassword('')
      setMessage(`Welcome to ShopSphere, ${data.customer.name}!`)

      await fetchOrders(data.token, data.customer.role)

    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Authentication failed')
    } finally {
      setAuthLoading(false)
    }
  }

  // LOGOUT
  const logout = () => {
    localStorage.removeItem(TOKEN_KEY)
    setToken('')
    setCustomer(null)
    setOrders([])
    setCustomerName('')
    setCustomerEmail('')
    setMessage('You have been logged out successfully')
  }

  // ADD TO CART
  const addToCart = (product: Product) => {
    setCart(previousCart => {
      const existing = previousCart.find(item => item.id === product.id)

      if (existing) {
        return previousCart.map(item =>
          item.id === product.id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        )
      }

      return [...previousCart, { ...product, quantity: 1 }]
    })

    setMessage(`${product.name} added to cart`)
  }

  // INCREASE QUANTITY
  const increaseQuantity = (id: number) => {
    setCart(previousCart =>
      previousCart.map(item =>
        item.id === id
          ? { ...item, quantity: item.quantity + 1 }
          : item
      )
    )
  }

  // DECREASE QUANTITY
  const decreaseQuantity = (id: number) => {
    setCart(previousCart =>
      previousCart
        .map(item =>
          item.id === id
            ? { ...item, quantity: item.quantity - 1 }
            : item
        )
        .filter(item => item.quantity > 0)
    )
  }

  // REMOVE FROM CART
  const removeFromCart = (id: number) => {
    setCart(previousCart =>
      previousCart.filter(item => item.id !== id)
    )
  }

  const totalAmount = cart.reduce(
    (total, item) => total + item.price * item.quantity,
    0
  )

  const totalItems = cart.reduce(
    (sum, item) => sum + item.quantity,
    0
  )

  // CHECKOUT
  const checkout = async () => {
    if (!customer && (!customerName.trim() || !customerEmail.trim())) {
      setMessage('Please enter your name and email, or login first')
      return
    }

    if (cart.length === 0) {
      setMessage('Your cart is empty')
      return
    }

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(`${API_BASE_URL}/api/orders`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          customerName: customer?.name || customerName,
          customerEmail: customer?.email || customerEmail,
          items: cart.map(item => ({
            productId: item.id,
            quantity: item.quantity
          }))
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Checkout failed')
        return
      }

      setMessage(`Order placed successfully! Order ID: ${data.order.id}. Please complete demo payment.`)

      setPendingPayment({
        orderId: data.order.id,
        paymentToken: data.paymentToken || null
      })

      setCart([])
      setCustomerName(customer?.name || '')
      setCustomerEmail(customer?.email || '')

      if (token) {
        await fetchOrders(token, customer?.role)
      }

    } catch {
      setMessage('Unable to place order')
    }
  }

  // MOCK PAYMENT - DEMO ONLY
  const processMockPayment = async (outcome: 'SUCCESS' | 'FAILURE') => {
    if (!pendingPayment || paymentLoading) {
      return
    }

    setPaymentLoading(true)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json'
      }

      if (token) {
        headers.Authorization = `Bearer ${token}`
      }

      const response = await fetch(
        `${API_BASE_URL}/api/orders/${pendingPayment.orderId}/mock-payment`,
        {
          method: 'POST',
          headers,
          body: JSON.stringify({
            outcome,
            paymentToken: pendingPayment.paymentToken
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Demo payment failed')
        return
      }

      setMessage(
        outcome === 'SUCCESS'
          ? `Demo payment successful! Order #${pendingPayment.orderId} is PAID.`
          : `Demo payment failed! Order #${pendingPayment.orderId} is marked FAILED.`
      )

      setPendingPayment(null)

      if (token) {
        await fetchOrders(token, customer?.role)
      }

    } catch {
      setMessage('Unable to process demo payment')
    } finally {
      setPaymentLoading(false)
    }
  }

  // START EDIT PRODUCT
  const startEditProduct = (product: Product) => {
    setEditingProduct(product)
    setEditName(product.name)
    setEditDescription(product.description || '')
    setEditPrice(String(product.price))
    setEditCategory(product.category || 'General')
    setEditImageUrl(product.imageUrl || '')
    setMessage('')
    window.location.hash = 'edit-product'
  }

  // UPDATE PRODUCT
  const saveProduct = async (e: FormEvent) => {
    e.preventDefault()

    if (!token || customer?.role !== 'ADMIN' || !editingProduct) {
      setMessage('Admin access required')
      return
    }

    setEditLoading(true)

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${editingProduct.id}`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...authHeaders(token)
          },
          body: JSON.stringify({
            name: editName.trim(),
            description: editDescription,
            price: Number(editPrice),
            category: editCategory,
            imageUrl: editImageUrl || null
          })
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Failed to update product')
        return
      }

      setMessage('Product updated successfully!')
      setEditingProduct(null)
      await fetchProducts()

    } catch {
      setMessage('Unable to update product')
    } finally {
      setEditLoading(false)
    }
  }

  // DELETE PRODUCT
  const deleteProduct = async (product: Product) => {
    if (!token || customer?.role !== 'ADMIN') {
      setMessage('Admin access required')
      return
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${product.name}"?`
    )

    if (!confirmed) return

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/products/${product.id}`,
        {
          method: 'DELETE',
          headers: authHeaders(token)
        }
      )

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Failed to delete product')
        return
      }

      setMessage('Product deleted successfully!')
      await fetchProducts()

    } catch {
      setMessage('Unable to delete product')
    }
  }

  // ADD PRODUCT
  const addProduct = async (e: FormEvent) => {
    e.preventDefault()
    setMessage('')

    if (!token || customer?.role !== 'ADMIN') {
      setMessage('Admin access required')
      return
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/products`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(token)
        },
        body: JSON.stringify({
          name,
          description,
          price: Number(price),
          category,
          imageUrl
        })
      })

      const data = await response.json()

      if (!response.ok) {
        setMessage(data.message || 'Failed to add product')
        return
      }

      setMessage('Product added successfully!')

      setName('')
      setDescription('')
      setPrice('')
      setCategory('Electronics')
      setImageUrl('')

      await fetchProducts()

    } catch {
      setMessage('Backend connection failed')
    }
  }

  return (
    <div className="app">

      <header className="navbar">
        <h1>ShopSphere</h1>

        <nav>
          <a href="#home">Home</a>
          <a href="#products">Products</a>
          <a href="#cart">Cart ({totalItems})</a>
          <a href="#orders">My Orders</a>
          <a href="#account">{customer ? 'My Account' : 'Login'}</a>
          {customer?.role === 'ADMIN' && <a href="#admin-dashboard">Dashboard</a>}
          {customer?.role === 'ADMIN' && <a href="#add-product">Add Product</a>}
        </nav>

        {customer && (
          <button className="logout-btn" onClick={logout}>
            Logout
          </button>
        )}
      </header>

      <section className="hero" id="home">
        <h2>Discover Amazing Products</h2>
        <p>Shop smarter. Live better.</p>

        <a href="#products" className="shop-btn">
          Shop Now
        </a>
      </section>

      {message && (
        <div className="app-message" role="status">
          {message}
          <button onClick={() => setMessage('')} aria-label="Dismiss message">
            Ãƒâ€”
          </button>
        </div>
      )}

      {/* ADMIN DASHBOARD */}
      {customer?.role === 'ADMIN' && (
        <section className="admin-dashboard" id="admin-dashboard">
          <div className="dashboard-heading">
            <div>
              <h2>Admin Dashboard</h2>
              <p>ShopSphere business overview</p>
            </div>

            <button
              className="auth-button"
              onClick={() => fetchAdminDashboard()}
              disabled={dashboardLoading}
            >
              {dashboardLoading ? 'Loading...' : 'Refresh Dashboard'}
            </button>
          </div>

          {dashboardLoading && !dashboard && (
            <p>Loading dashboard data...</p>
          )}

          {dashboard && (
            <>
              <div className="dashboard-cards">

                <div className="dashboard-card">
                  <span>Total Orders</span>
                  <h3>{dashboard.stats.totalOrders}</h3>
                </div>

                <div className="dashboard-card">
                  <span>Total Order Value</span>
                  <h3>
                    {dashboard.stats.totalOrderValue.toLocaleString('en-IN', {
                      style: 'currency',
                      currency: 'INR',
                      maximumFractionDigits: 2
                    })}
                  </h3>
                </div>

                <div className="dashboard-card">
                  <span>Total Customers</span>
                  <h3>{dashboard.stats.totalCustomers}</h3>
                </div>

                <div className="dashboard-card">
                  <span>Total Products</span>
                  <h3>{dashboard.stats.totalProducts}</h3>
                </div>

              </div>

              <div className="dashboard-recent">
                <h3>Recent Orders</h3>

                {dashboard.recentOrders.length === 0 ? (
                  <p>No orders available.</p>
                ) : (
                  <div className="dashboard-table-wrapper">
                    <table className="dashboard-table">
                      <thead>
                        <tr>
                          <th>Order ID</th>
                          <th>Customer</th>
                          <th>Email</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Payment</th>
                          <th>Date</th>
                        </tr>
                      </thead>

                      <tbody>
                        {dashboard.recentOrders.map(order => (
                          <tr key={order.id}>
                            <td>#{order.id}</td>
                            <td>{order.customerName}</td>
                            <td>{order.customerEmail}</td>
                            <td>
                              {order.totalAmount.toLocaleString('en-IN', {
                                style: 'currency',
                                currency: 'INR'
                              })}
                            </td>
                            <td>
                              <span className="dashboard-status">
                                {order.status}
                              </span>
                            </td>
                            <td>
                              <strong style={{
                                color: order.paymentStatus === 'PAID'
                                  ? '#16a34a'
                                  : order.paymentStatus === 'FAILED'
                                    ? '#dc2626'
                                    : '#d97706'
                              }}>
                                {order.paymentStatus || 'NOT RECORDED'}
                              </strong>
                            </td>
                            <td>
                              {new Date(order.createdAt).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      )}

      {/* CUSTOMER ACCOUNT */}
      <section className="products" id="account">
        <h2>{customer ? 'My Account' : 'Customer Account'}</h2>

        {customer ? (
          <div className="account-card">
            <div className="account-avatar">
              {customer.name.charAt(0).toUpperCase()}
            </div>

            <h3>Welcome, {customer.name}</h3>
            <p><strong>Customer ID:</strong> {customer.id}</p>
            <p><strong>Name:</strong> {customer.name}</p>
            <p><strong>Email:</strong> {customer.email}</p>

            {customer.createdAt && (
              <p>
                <strong>Member Since:</strong>{' '}
                {new Date(customer.createdAt).toLocaleDateString()}
              </p>
            )}

            <button className="auth-button" onClick={logout}>
              Logout
            </button>
          </div>
        ) : (
          <div className="auth-card">
            <div className="auth-tabs">
              <button
                className={authMode === 'login' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('login')
                  setMessage('')
                }}
              >
                Login
              </button>

              <button
                className={authMode === 'register' ? 'active' : ''}
                onClick={() => {
                  setAuthMode('register')
                  setMessage('')
                }}
              >
                Register
              </button>
            </div>

            <h3>
              {authMode === 'login'
                ? 'Welcome Back!'
                : 'Create Your Account'}
            </h3>

            <p>
              {authMode === 'login'
                ? 'Login to view your profile and orders.'
                : 'Register to become a ShopSphere customer.'}
            </p>

            <form onSubmit={handleAuthentication}>
              {authMode === 'register' && (
                <input
                  type="text"
                  placeholder="Full Name"
                  value={authName}
                  onChange={e => setAuthName(e.target.value)}
                  required
                />
              )}

              <input
                type="email"
                placeholder="Email Address"
                value={authEmail}
                onChange={e => setAuthEmail(e.target.value)}
                required
              />

              <input
                type="password"
                placeholder="Password (minimum 8 characters)"
                value={authPassword}
                onChange={e => setAuthPassword(e.target.value)}
                minLength={8}
                required
              />

              <button
                className="auth-button"
                type="submit"
                disabled={authLoading}
              >
                {authLoading
                  ? 'Please wait...'
                  : authMode === 'login'
                    ? 'Login'
                    : 'Create Account'}
              </button>
            </form>
          </div>
        )}
      </section>

      {/* PRODUCTS */}
      <section className="products" id="products">
        <h2>Featured Products</h2>

        <div className="product-filters">
          <input
            type="text"
            placeholder="Search products..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />

          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>

            {categories.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </div>

        {loading && <p>Loading products...</p>}

        {!loading && filteredProducts.length === 0 && (
          <p>No products found.</p>
        )}

        <div className="product-grid">
          {filteredProducts.map(product => (
            <div className="product-card" key={product.id}>
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  className="product-image"
                />
              ) : (
                <div className="product-icon">Ã°Å¸â€ºÂÃ¯Â¸Â</div>
              )}

              <span className="product-category">
                {product.category || 'General'}
              </span>

              <h3>{product.name}</h3>
              <p>{product.description}</p>
              <h3>₹{product.price.toFixed(2)}</h3>

              <button onClick={() => addToCart(product)}>
                Add to Cart
              </button>

              {customer?.role === 'ADMIN' && (
                <div className="admin-product-actions">
                  <button
                    type="button"
                    onClick={() => startEditProduct(product)}
                  >
                    Edit Product
                  </button>

                  <button
                    type="button"
                    onClick={() => deleteProduct(product)}
                  >
                    Delete Product
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* SHOPPING CART */}
      <section className="products" id="cart">
        <h2>Shopping Cart ({totalItems})</h2>

        {cart.length === 0 ? (
          <p>Your cart is empty.</p>
        ) : (
          <>
            {cart.map(item => (
              <div className="product-card cart-card" key={item.id}>
                <h3>{item.name}</h3>
                <p>Price: ₹{item.price}</p>

                <div className="quantity-controls">
                  <button onClick={() => decreaseQuantity(item.id)}>
                    -
                  </button>

                  <strong>{item.quantity}</strong>

                  <button onClick={() => increaseQuantity(item.id)}>
                    +
                  </button>
                </div>

                <p>
                  Subtotal: ₹{(item.price * item.quantity).toFixed(2)}
                </p>

                <button onClick={() => removeFromCart(item.id)}>
                  Remove Product
                </button>
              </div>
            ))}

            <h2>Total Amount: ₹{totalAmount.toFixed(2)}</h2>

            <hr />

            <h3>Customer Details</h3>

            {customer ? (
              <div className="checkout-customer">
                <p><strong>Name:</strong> {customer.name}</p>
                <p><strong>Email:</strong> {customer.email}</p>
                <p>Your order will be linked to your account.</p>
              </div>
            ) : (
              <>
                <p>Checkout as guest or login to link orders to your account.</p>

                <input
                  type="text"
                  placeholder="Customer Name"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  required
                />

                <input
                  type="email"
                  placeholder="Customer Email"
                  value={customerEmail}
                  onChange={e => setCustomerEmail(e.target.value)}
                  required
                />
              </>
            )}

            <button className="auth-button" onClick={checkout}>
              Place Order
            </button>
          </>
        )}
        {pendingPayment && (
          <div className="product-card" style={{ marginTop: '20px', padding: '20px', border: '2px solid #2563eb' }}>
            <h3>Demo Payment</h3>
            <p>Order ID: #{pendingPayment.orderId}</p>
            <p>This is a simulated payment for learning purposes. No real money will be charged.</p>

            <button
              className="auth-button"
              onClick={() => processMockPayment('SUCCESS')}
              disabled={paymentLoading}
            >
              {paymentLoading ? 'Processing...' : 'Demo Payment Success'}
            </button>

            <button
              className="auth-button"
              style={{ marginLeft: '10px', background: '#dc2626' }}
              onClick={() => processMockPayment('FAILURE')}
              disabled={paymentLoading}
            >
              {paymentLoading ? 'Processing...' : 'Demo Payment Failure'}
            </button>
          </div>
        )}
      </section>

      {/* CUSTOMER ORDERS */}
      <section className="products" id="orders">
        <h2>{customer?.role === 'ADMIN' ? 'All Customer Orders' : 'My Orders'}</h2>

        {!customer ? (
          <div className="auth-notice">
            <p>Please login to view your order history.</p>
            <a href="#account" className="shop-btn">
              Login to Continue
            </a>
          </div>
        ) : (
          <>
            <p>{customer.role === 'ADMIN' ? 'Admin view: all customer orders.' : `Welcome, ${customer.name}. View your recent orders.`}</p>

            <button
              className="auth-button refresh-btn"
              onClick={() => fetchOrders()}
              disabled={ordersLoading}
            >
              {ordersLoading ? 'Refreshing...' : 'Refresh Orders'}
            </button>

            {ordersLoading && <p>Loading orders...</p>}

            {!ordersLoading && orders.length === 0 && (
              <p>No orders found. Start shopping!</p>
            )}

            <div className="product-grid">
              {orders.map(order => (
                <div className="product-card" key={order.id}>
                  <h3>Order #{order.id}</h3>

                  <span className="product-category">
                    {order.status}
                  </span>

                  <p style={{
                    marginTop: '12px',
                    fontWeight: 'bold',
                    color: order.paymentStatus === 'PAID'
                      ? '#16a34a'
                      : order.paymentStatus === 'FAILED'
                        ? '#dc2626'
                        : '#d97706'
                  }}>
                    Payment Status: {order.paymentStatus || 'NOT RECORDED'}
                  </p>
                  <div style={{ margin: '20px 0', padding: '15px', background: '#f8fafc', borderRadius: '10px' }}>
                    <h4>Order Tracking</h4>

                    {order.status === 'CANCELLED' ? (
                      <p style={{ color: '#dc2626', fontWeight: 'bold' }}>
                        Order Cancelled
                      </p>
                    ) : (
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', flexWrap: 'wrap' }}>
                        {['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'].map((step, index) => {
                          const currentIndex = ['PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED'].indexOf(order.status)
                          const completed = index <= currentIndex

                          return (
                            <div key={step} style={{ flex: '1', minWidth: '65px', textAlign: 'center' }}>
                              <div style={{
                                width: '28px',
                                height: '28px',
                                lineHeight: '28px',
                                borderRadius: '50%',
                                margin: '0 auto 8px',
                                background: completed ? '#16a34a' : '#d1d5db',
                                color: 'white',
                                fontWeight: 'bold'
                              }}>
                                {completed ? '✓' : index + 1}
                              </div>
                              <small style={{ fontWeight: completed ? 'bold' : 'normal' }}>
                                {step === 'PENDING' ? 'Order Placed' : step === 'PROCESSING' ? 'Processing' : step === 'SHIPPED' ? 'Shipped' : 'Delivered'}
                              </small>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  {customer?.role === 'ADMIN' && (
                    <div>
                      <label><strong>Update Order Status: </strong></label>
                      <select
                        value={order.status}
                        onChange={e => updateOrderStatus(order.id, e.target.value)}
                      >
                        <option value="PENDING">PENDING</option>
                        <option value="PROCESSING">PROCESSING</option>
                        <option value="SHIPPED">SHIPPED</option>
                        <option value="DELIVERED">DELIVERED</option>
                        <option value="CANCELLED">CANCELLED</option>
                      </select>
                    </div>
                  )}

                  <p>
                    <strong>Customer:</strong> {order.customerName}
                  </p>

                  <p>
                    <strong>Email:</strong> {order.customerEmail}
                  </p>

                  <p>
                    <strong>Order Date:</strong>{' '}
                    {new Date(order.createdAt).toLocaleString()}
                  </p>

                  <hr />

                  <h3>Purchased Products</h3>

                  {order.items.map(item => (
                    <div key={item.id}>
                      <p><strong>{item.product.name}</strong></p>
                      <p>Quantity: {item.quantity}</p>
                      <p>Price: ₹{item.price.toFixed(2)}</p>

                      <p>
                        Subtotal: ₹{(item.price * item.quantity).toFixed(2)}
                      </p>

                      <hr />
                    </div>
                  ))}

                  <h3>Total: ₹{order.totalAmount.toFixed(2)}</h3>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      {/* ADMIN-ONLY EDIT PRODUCT */}
      {customer?.role === 'ADMIN' && editingProduct && (
        <section className="products" id="edit-product">
          <h2>Edit Product</h2>

          <form onSubmit={saveProduct}>
            <input
              type="text"
              placeholder="Product Name"
              value={editName}
              onChange={e => setEditName(e.target.value)}
              required
            />

            <input
              type="text"
              placeholder="Description"
              value={editDescription}
              onChange={e => setEditDescription(e.target.value)}
            />

            <input
              type="number"
              placeholder="Price"
              value={editPrice}
              onChange={e => setEditPrice(e.target.value)}
              min="0.01"
              step="0.01"
              required
            />

            <select
              value={editCategory}
              onChange={e => setEditCategory(e.target.value)}
            >
              {categories.map(item => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>

            <input
              type="url"
              placeholder="Product Image URL"
              value={editImageUrl}
              onChange={e => setEditImageUrl(e.target.value)}
            />

            <button type="submit" disabled={editLoading}>
              {editLoading ? 'Saving...' : 'Save Changes'}
            </button>

            <button
              type="button"
              onClick={() => setEditingProduct(null)}
            >
              Cancel
            </button>
          </form>
        </section>
      )}

      {/* ADMIN-ONLY ADD PRODUCT */}
      {customer?.role === 'ADMIN' && (
      <section className="products" id="add-product">
        <h2>Add New Product</h2>

        <form onSubmit={addProduct}>
          <input
            type="text"
            placeholder="Product Name"
            value={name}
            onChange={e => setName(e.target.value)}
            required
          />

          <input
            type="text"
            placeholder="Description"
            value={description}
            onChange={e => setDescription(e.target.value)}
          />

          <input
            type="number"
            placeholder="Price"
            value={price}
            onChange={e => setPrice(e.target.value)}
            min="0.01"
            step="0.01"
            required
          />

          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
          >
            {categories.map(item => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <input
            type="url"
            placeholder="Product Image URL (https://...)"
            value={imageUrl}
            onChange={e => setImageUrl(e.target.value)}
          />

          <button type="submit">
            Add Product
          </button>
        </form>
      </section>
      )}

      <footer>
        <p>Ã‚Â© 2026 ShopSphere. All Rights Reserved.</p>
        <p>Powered by AWS Cloud</p>
      </footer>

    </div>
  )
}

export default App



