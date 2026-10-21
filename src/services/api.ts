import { get, set } from 'idb-keyval'
import type { Produto, Categoria, Cliente, TabelaPreco, ItemCarrinho } from '../types'

const API_BASE = import.meta.env.VITE_API_URL || 'https://vendas-api.72.60.53.223.nip.io'

function getToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)thoth_vendas_token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return localStorage.getItem('thoth_vendas_token')
}

export function setToken(token: string) {
  localStorage.setItem('thoth_vendas_token', token)
  document.cookie = `thoth_vendas_token=${encodeURIComponent(token)}; path=/; max-age=604800; SameSite=Lax`
}

export function clearToken() {
  localStorage.removeItem('thoth_vendas_token')
  document.cookie = 'thoth_vendas_token=; path=/; max-age=-1'
}

async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
    credentials: 'include',
  })

  if (res.status === 401) {
    // Redirecionamento transparente ao Authentik se não autenticado
    const isLocal = window.location.search.includes('local=1')
    if (!isLocal) {
      window.location.href = `${API_BASE}/api/auth/oidc/start?target=${encodeURIComponent(window.location.pathname)}`
    }
    throw new Error('Sessão expirada')
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new Error(errorBody.error || `Erro HTTP ${res.status}`)
  }

  return res.json()
}

// 1. Produtos com Fallback Offline
export async function getProdutos(): Promise<{ produtos: Produto[]; fromCache: boolean }> {
  try {
    const data = await fetchWithAuth('/api/produtos')
    const list: Produto[] = data.produtos || []
    if (list.length > 0) {
      await set('offline_produtos', list)
      await set('offline_produtos_time', new Date().toISOString())
    }
    return { produtos: list, fromCache: false }
  } catch (err) {
    const cached = await get<Produto[]>('offline_produtos')
    if (cached && cached.length > 0) {
      return { produtos: cached, fromCache: true }
    }
    throw err
  }
}

// 2. Categorias com Fallback Offline
export async function getCategorias(): Promise<Categoria[]> {
  try {
    const data = await fetchWithAuth('/api/categorias')
    const list: Categoria[] = data.categorias || []
    if (list.length > 0) {
      await set('offline_categorias', list)
    }
    return list
  } catch (err) {
    const cached = await get<Categoria[]>('offline_categorias')
    return cached || []
  }
}

// 3. Tabelas de Preço
export async function getTabelasPreco(): Promise<TabelaPreco[]> {
  try {
    const data = await fetchWithAuth('/api/tabelas-preco')
    const list: TabelaPreco[] = data.tabelas || []
    if (list.length > 0) {
      await set('offline_tabelas', list)
    }
    return list
  } catch (err) {
    const cached = await get<TabelaPreco[]>('offline_tabelas')
    return cached || []
  }
}

// 4. Clientes da Carteira
export async function getClientes(): Promise<Cliente[]> {
  try {
    const data = await fetchWithAuth('/api/clientes')
    const list: Cliente[] = data.clientes || []
    if (list.length > 0) {
      await set('offline_clientes', list)
    }
    return list
  } catch (err) {
    const cached = await get<Cliente[]>('offline_clientes')
    return cached || []
  }
}

// 5. Enviar Pedido
export interface CriarPedidoPayload {
  clienteId: string
  tabelaPrecoId?: string
  formaPagamentoId?: string
  prazoPagamentoId?: string
  observacoes?: string
  itens: {
    produtoId: string
    quantidade: number
    precoUnitario: number
    descontoPct: number
  }[]
}

export async function enviarPedido(payload: CriarPedidoPayload): Promise<any> {
  try {
    const data = await fetchWithAuth('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data
  } catch (err) {
    // Se offline, enfileira para sincronização posterior
    if (!navigator.onLine) {
      const queue = (await get<any[]>('pending_orders_queue')) || []
      queue.push({ ...payload, queuedAt: new Date().toISOString() })
      await set('pending_orders_queue', queue)
      return { ok: true, offlineQueued: true }
    }
    throw err
  }
}

// 6. Dados do Vendedor Autenticado
export async function getMe(): Promise<any> {
  try {
    return await fetchWithAuth('/api/auth/me')
  } catch {
    return null
  }
}
