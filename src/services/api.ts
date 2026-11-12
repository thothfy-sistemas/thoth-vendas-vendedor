import { del, get, set } from 'idb-keyval'
import type {
  Produto,
  Categoria,
  Cliente,
  TabelaPreco,
  ItemCarrinho,
  OrcamentoSalvo,
  EmpresaVinculo,
  UsuarioVendedor,
  Pedido,
  VendedorMeta,
  NovoClientePayload,
  CriarPedidoPayload,
  PendingOfflineOrder,
  FormaPagamento,
  PrazoPagamento,
} from '../types'

// Duas URLs oficiais da API com failover automático (alta disponibilidade)
export const API_URLS: string[] = [
  import.meta.env.VITE_API_URL || 'https://api.thothvendas.com.br',
  'https://vendas-api.thothfy.com.br',
]

let activeApiIndex = 0

export class AuthError extends Error {
  readonly status = 401
  constructor(message = 'Sessão expirada. Faça login com seu CPF e PIN.') {
    super(message)
    this.name = 'AuthError'
  }
}

export class HttpError extends Error {
  readonly status: number
  constructor(status: number, message: string) {
    super(message)
    this.name = 'HttpError'
    this.status = status
  }
}

export class NetworkError extends Error {
  constructor(message = 'Sem conexão com o servidor de vendas.') {
    super(message)
    this.name = 'NetworkError'
  }
}

export function isNetworkOfflineError(err: unknown): boolean {
  if (err instanceof AuthError) return false
  if (err instanceof HttpError) {
    return err.status >= 502 && err.status <= 504
  }
  if (err instanceof NetworkError) return true
  if (typeof navigator !== 'undefined' && !navigator.onLine) return true
  if (err instanceof TypeError) return true
  const msg = String((err as { message?: string })?.message || '').toLowerCase()
  return (
    msg.includes('sem conexão') ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network request failed') ||
    msg.includes('load failed') ||
    msg.includes('aborted')
  )
}

export function getApiBase(): string {
  return API_URLS[activeApiIndex] || API_URLS[0]
}

async function fetchFromApi(endpoint: string, init: RequestInit): Promise<Response> {
  let lastErr: unknown
  for (let i = 0; i < API_URLS.length; i++) {
    const idx = (activeApiIndex + i) % API_URLS.length
    const base = API_URLS[idx]
    try {
      const res = await fetch(`${base}${endpoint}`, {
        ...init,
        cache: init.cache ?? 'no-store',
      })
      if (res.status >= 502 && res.status <= 504 && i < API_URLS.length - 1) {
        lastErr = new HttpError(res.status, `Gateway HTTP ${res.status}`)
        continue
      }
      activeApiIndex = idx
      return res
    } catch (err) {
      lastErr = err
    }
  }
  if (lastErr instanceof HttpError) {
    throw lastErr
  }
  throw new NetworkError(
    lastErr instanceof Error ? lastErr.message : 'Sem conexão com o servidor de vendas.'
  )
}

export async function checkServerConnectivity(timeoutMs = 4000): Promise<boolean> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return false
  }
  for (let i = 0; i < API_URLS.length; i++) {
    const idx = (activeApiIndex + i) % API_URLS.length
    const base = API_URLS[idx]
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(`${base}/health`, {
        method: 'GET',
        cache: 'no-store',
        signal: controller.signal,
      })
      if (res.ok) {
        activeApiIndex = idx
        return true
      }
    } catch {
      // tenta próximo endpoint
    } finally {
      clearTimeout(timer)
    }
  }
  return false
}

const ACTIVE_EMPRESA_STORAGE_KEY = 'thoth_vendas_empresa_id'
const ACTIVE_USER_STORAGE_KEY = 'thoth_vendas_user_id'

export function getActiveUserId(): string | undefined {
  try {
    return localStorage.getItem(ACTIVE_USER_STORAGE_KEY) || undefined
  } catch {
    return undefined
  }
}

export function setActiveUserId(userId?: string | null) {
  try {
    const prev = localStorage.getItem(ACTIVE_USER_STORAGE_KEY)
    if (userId) {
      if (prev && prev !== userId) {
        // Troca de vendedor/usuário no mesmo dispositivo: isola orçamentos e rascunhos locais
        localStorage.removeItem(ORCAMENTOS_STORAGE_KEY)
        localStorage.removeItem('vendedor_carrinho')
        localStorage.removeItem('vendedor_cliente')
        void clearOfflineDataCache()
      }
      localStorage.setItem(ACTIVE_USER_STORAGE_KEY, userId)
    } else {
      localStorage.removeItem(ACTIVE_USER_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

export function getActiveEmpresaId(): string | undefined {
  try {
    return localStorage.getItem(ACTIVE_EMPRESA_STORAGE_KEY) || undefined
  } catch {
    return undefined
  }
}

export function setActiveEmpresaId(empresaId?: string | null) {
  try {
    if (empresaId) {
      localStorage.setItem(ACTIVE_EMPRESA_STORAGE_KEY, empresaId)
    } else {
      localStorage.removeItem(ACTIVE_EMPRESA_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
}

const OFFLINE_CACHE_KEYS = [
  'offline_produtos',
  'offline_produtos_time',
  'offline_categorias',
  'offline_tabelas',
  'offline_formas_pagamento',
  'offline_prazos_pagamento',
  'offline_clientes',
  'offline_pedidos',
  'offline_vendedor_meta',
  'offline_me',
]

export async function clearOfflineDataCache(): Promise<void> {
  await Promise.all(OFFLINE_CACHE_KEYS.map((key) => del(key).catch(() => undefined)))
}

export function getToken(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)thoth_vendas_token=([^;]+)/)
  if (match) return decodeURIComponent(match[1])
  return localStorage.getItem('thoth_vendas_token')
}

export function setToken(token: string) {
  localStorage.setItem('thoth_vendas_token', token)
  document.cookie = `thoth_vendas_token=${encodeURIComponent(token)}; path=/; max-age=2592000; SameSite=Lax`
}

export function clearToken() {
  localStorage.removeItem('thoth_vendas_token')
  document.cookie = 'thoth_vendas_token=; path=/; max-age=-1'
}

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}): Promise<any> {
  const token = getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetchFromApi(endpoint, {
    ...options,
    headers,
    cache: 'no-store',
    credentials: 'include',
  })

  if (res.status === 401) {
    clearToken()
    throw new AuthError('Sessão expirada. Faça login com seu CPF e PIN.')
  }

  if (!res.ok) {
    const errorBody = await res.json().catch(() => ({}))
    throw new HttpError(res.status, errorBody.error || `Erro HTTP ${res.status}`)
  }

  if (res.status === 204) {
    return { ok: true }
  }

  return res.json()
}

// Autenticação de Vendedor (CPF + PIN)
export interface LoginResponse {
  ok: boolean
  requerSelecaoEmpresa?: boolean
  token?: string
  user: UsuarioVendedor
  empresaAtiva?: EmpresaVinculo
  empresas: EmpresaVinculo[]
  error?: string
}

export async function loginVendedor(cpf: string, pin: string): Promise<LoginResponse> {
  const res = await fetchFromApi('/api/auth/vendedor/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cpf, pin }),
    cache: 'no-store',
    credentials: 'include',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Falha ao autenticar. Verifique o CPF e o PIN.')
  }

  await clearOfflineDataCache()

  if (data.user?.id) {
    setActiveUserId(data.user.id)
  }
  if (data.token && !data.requerSelecaoEmpresa) {
    setToken(data.token)
  }
  const empresaId = data.empresaAtiva?.empresa_id || data.empresaAtiva?.id
  if (empresaId) {
    setActiveEmpresaId(empresaId)
  }

  return data
}

export async function selecionarEmpresa(empresaId: string, tempToken?: string): Promise<LoginResponse> {
  const token = tempToken || getToken() || ''
  const res = await fetchFromApi('/api/auth/vendedor/selecionar-empresa', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ empresaId, token }),
    cache: 'no-store',
    credentials: 'include',
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data.ok) {
    throw new Error(data.error || 'Falha ao selecionar empresa.')
  }

  await clearOfflineDataCache()

  if (data.user?.id) {
    setActiveUserId(data.user.id)
  }
  if (data.token) {
    setToken(data.token)
  }
  const resolvedEmpresaId = data.empresaAtiva?.empresa_id || data.empresaAtiva?.id || empresaId
  setActiveEmpresaId(resolvedEmpresaId)

  return data
}

export async function logoutVendedor() {
  try {
    await fetchWithAuth('/api/auth/logout', { method: 'POST' })
  } catch {
    // best effort cookie cleanup
  }
  clearToken()
  setActiveEmpresaId(null)
  setActiveUserId(null)
  await clearOfflineDataCache()
  localStorage.removeItem(ORCAMENTOS_STORAGE_KEY)
  localStorage.removeItem('vendedor_carrinho')
  localStorage.removeItem('vendedor_cliente')
  window.location.reload()
}

// 1. Produtos: estritamente online-first; fallback offline SOMENTE em erro de rede
export async function getProdutos(): Promise<{ produtos: Produto[]; fromCache: boolean }> {
  try {
    const data = await fetchWithAuth('/api/produtos')
    const list: Produto[] = data.produtos || []
    await set('offline_produtos', list)
    await set('offline_produtos_time', new Date().toISOString())
    return { produtos: list, fromCache: false }
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = await get<Produto[]>('offline_produtos')
      if (cached) {
        return { produtos: cached, fromCache: true }
      }
    }
    throw err
  }
}

// 2. Categorias com Fallback Offline apenas em erro de rede
export async function getCategorias(): Promise<Categoria[]> {
  try {
    const data = await fetchWithAuth('/api/categorias')
    const list: Categoria[] = data.categorias || []
    await set('offline_categorias', list)
    return list
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = await get<Categoria[]>('offline_categorias')
      return cached || []
    }
    throw err
  }
}

// 3. Tabelas de Preço (com deduplicação por nome)
function deduplicarTabelas(list: TabelaPreco[]): TabelaPreco[] {
  const seen = new Set<string>()
  const out: TabelaPreco[] = []
  for (const t of list) {
    const key = (t.nome || '').trim().toLowerCase()
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(t)
  }
  return out
}

export async function getTabelasPreco(): Promise<TabelaPreco[]> {
  try {
    const data = await fetchWithAuth('/api/tabelas-preco')
    const list = deduplicarTabelas(data.tabelas || [])
    await set('offline_tabelas', list)
    return list
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = await get<TabelaPreco[]>('offline_tabelas')
      return deduplicarTabelas(cached || [])
    }
    throw err
  }
}

// 3b. Condições e Formas de Pagamento com Fallback Offline apenas em erro de rede
export async function getCondicoesPagamento(): Promise<{
  formas: FormaPagamento[]
  prazos: PrazoPagamento[]
}> {
  try {
    const data = await fetchWithAuth('/api/condicoes-pagamento')
    const formas: FormaPagamento[] = data.formas || []
    const prazos: PrazoPagamento[] = data.prazos || []
    await set('offline_formas_pagamento', formas)
    await set('offline_prazos_pagamento', prazos)
    return { formas, prazos }
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const formas = (await get<FormaPagamento[]>('offline_formas_pagamento')) || []
      const prazos = (await get<PrazoPagamento[]>('offline_prazos_pagamento')) || []
      return { formas, prazos }
    }
    throw err
  }
}

// 4. Clientes da Carteira
export async function getClientes(): Promise<Cliente[]> {
  try {
    const data = await fetchWithAuth('/api/clientes')
    const list: Cliente[] = data.clientes || []
    await set('offline_clientes', list)
    return list
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = await get<Cliente[]>('offline_clientes')
      return cached || []
    }
    throw err
  }
}

// 5. Fila Offline + Envio de Pedido (com mutex contra envio duplicado)
const PENDING_QUEUE_KEY = 'pending_orders_queue'

export async function getPendingOfflineOrders(): Promise<PendingOfflineOrder[]> {
  const queue = (await get<PendingOfflineOrder[]>(PENDING_QUEUE_KEY)) || []
  return queue
}

export async function removePendingOfflineOrder(localId: string): Promise<void> {
  const queue = await getPendingOfflineOrders()
  await set(
    PENDING_QUEUE_KEY,
    queue.filter((q) => q.localId !== localId)
  )
}

function buildPendingOrderEntry(
  payload: CriarPedidoPayload,
  meta?: {
    localId?: string
    empresaId?: string
    clienteNome?: string
    totalEstimado?: number
    descontoValor?: number
    descontoPercentual?: number
    itensResumo?: PendingOfflineOrder['itensResumo']
  }
): PendingOfflineOrder {
  const bruto = payload.itens.reduce((acc, it) => acc + it.quantidade * it.precoUnitario, 0)
  const descontoItens = payload.itens.reduce((acc, it) => {
    const sub = it.quantidade * it.precoUnitario
    const itemDesc =
      it.descontoValor && it.descontoValor > 0
        ? it.descontoValor
        : sub * ((it.descontoPct || 0) / 100)
    return acc + itemDesc
  }, 0)
  const descontoValor =
    meta?.descontoValor ??
    payload.descontoValor ??
    payload.descontoGeralValor ??
    Number(descontoItens.toFixed(2))
  const descontoPercentual =
    meta?.descontoPercentual ??
    payload.descontoPercentual ??
    (bruto > 0 ? Number(((descontoValor / bruto) * 100).toFixed(2)) : 0)
  const totalEstimado =
    meta?.totalEstimado ?? Math.max(0, Number((bruto - descontoValor).toFixed(2)))
  const empresaId = meta?.empresaId || payload.empresaId || getActiveEmpresaId()

  const normalizedPayload: CriarPedidoPayload = {
    clienteId: payload.clienteId,
    empresaId,
    tabelaPrecoId: payload.tabelaPrecoId,
    formaPagamentoId: payload.formaPagamentoId,
    prazoPagamentoId: payload.prazoPagamentoId,
    condicaoPagamento: payload.condicaoPagamento || 'À Vista',
    formaPagamento: payload.formaPagamento,
    status: payload.status || 'pendente',
    descontoGeralValor: payload.descontoGeralValor ?? (descontoValor > 0 ? descontoValor : undefined),
    descontoValor: payload.descontoValor ?? descontoValor,
    descontoPercentual: payload.descontoPercentual ?? descontoPercentual,
    observacoes: payload.observacoes,
    itens: payload.itens,
  }

  return {
    localId: meta?.localId || `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    empresaId,
    clienteNome: meta?.clienteNome || 'Cliente selecionado',
    condicaoPagamento: normalizedPayload.condicaoPagamento || 'À Vista',
    formaPagamento: normalizedPayload.formaPagamento,
    descontoValor,
    descontoPercentual,
    totalEstimado,
    itensResumo: meta?.itensResumo || [],
    queuedAt: new Date().toISOString(),
    payload: normalizedPayload,
  }
}

export async function enviarPedido(
  payload: CriarPedidoPayload,
  meta?: {
    empresaId?: string
    clienteNome?: string
    totalEstimado?: number
    descontoValor?: number
    descontoPercentual?: number
    itensResumo?: PendingOfflineOrder['itensResumo']
    permitirOffline?: boolean
  }
): Promise<any> {
  const queueAndReturn = async () => {
    const queue = await getPendingOfflineOrders()
    const entry = buildPendingOrderEntry(payload, meta)
    await set(PENDING_QUEUE_KEY, [entry, ...queue])
    return { ok: true, offlineQueued: true, offlineOrder: entry }
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine && meta?.permitirOffline !== false) {
    return queueAndReturn()
  }

  try {
    const data = await fetchWithAuth('/api/pedidos', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return data
  } catch (err: any) {
    if (isNetworkOfflineError(err) && meta?.permitirOffline !== false) {
      return queueAndReturn()
    }
    throw err
  }
}

let syncInFlight: Promise<{
  synced: number
  failed: number
  remaining: PendingOfflineOrder[]
  authExpired?: boolean
}> | null = null

async function runSyncPendingOfflineOrders(): Promise<{
  synced: number
  failed: number
  remaining: PendingOfflineOrder[]
  authExpired?: boolean
}> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const remaining = await getPendingOfflineOrders()
    return { synced: 0, failed: 0, remaining }
  }

  const queue = await getPendingOfflineOrders()
  if (queue.length === 0) {
    return { synced: 0, failed: 0, remaining: [] }
  }

  const activeEmpresaId = getActiveEmpresaId()
  const syncedIds = new Set<string>()
  const errorMap = new Map<string, string>()
  let synced = 0
  let failed = 0
  let authExpired = false

  // Envia na ordem cronológica (mais antigo primeiro)
  const ordered = [...queue].reverse()

  for (const item of ordered) {
    if (item.empresaId && activeEmpresaId && item.empresaId !== activeEmpresaId) {
      continue
    }

    try {
      const res = await fetchWithAuth('/api/pedidos', {
        method: 'POST',
        body: JSON.stringify(item.payload),
      })
      synced++
      syncedIds.add(item.localId)

      if (item.payload.status === 'orcamento' && res?.pedido?.id) {
        const locais = getOrcamentosLocais()
        let changed = false
        const updatedLocais = locais.map((orc) => {
          if (orc.pendingLocalId === item.localId) {
            changed = true
            return {
              ...orc,
              pedidoId: res.pedido.id,
              numero: res.pedido.numero || orc.numero,
              pendingLocalId: undefined,
              updatedAt: new Date().toISOString(),
            }
          }
          return orc
        })
        if (changed) {
          setOrcamentosLocais(updatedLocais)
        }
      }
    } catch (err: any) {
      if (err instanceof AuthError) {
        authExpired = true
        break
      }
      failed++
      errorMap.set(item.localId, err?.message || 'Falha ao sincronizar')
    }
  }

  const latestQueue = await getPendingOfflineOrders()
  const remaining = latestQueue
    .filter((q) => !syncedIds.has(q.localId))
    .map((q) =>
      errorMap.has(q.localId) ? { ...q, lastError: errorMap.get(q.localId) } : q
    )

  await set(PENDING_QUEUE_KEY, remaining)
  return { synced, failed, remaining, authExpired }
}

export function syncPendingOfflineOrders(): Promise<{
  synced: number
  failed: number
  remaining: PendingOfflineOrder[]
  authExpired?: boolean
}> {
  if (syncInFlight) return syncInFlight
  syncInFlight = runSyncPendingOfflineOrders().finally(() => {
    syncInFlight = null
  })
  return syncInFlight
}

// 6. Orçamentos Salvos (Local + Sincronizado com API / Fila Offline)
const ORCAMENTOS_STORAGE_KEY = 'thoth_vendedor_orcamentos_salvos'

export function getOrcamentosLocais(): OrcamentoSalvo[] {
  try {
    const raw = localStorage.getItem(ORCAMENTOS_STORAGE_KEY)
    const parsed: OrcamentoSalvo[] = raw ? JSON.parse(raw) : []
    const activeUserId = getActiveUserId()
    const activeEmpresaId = getActiveEmpresaId()
    return parsed.filter((o) => {
      if (activeUserId && o.vendedorId && o.vendedorId !== activeUserId) return false
      if (activeEmpresaId && o.empresaId && o.empresaId !== activeEmpresaId) return false
      return true
    })
  } catch {
    return []
  }
}

function setOrcamentosLocais(list: OrcamentoSalvo[]) {
  localStorage.setItem(ORCAMENTOS_STORAGE_KEY, JSON.stringify(list))
}

export async function salvarOrcamento(params: {
  id?: string
  empresaId?: string
  cliente: Cliente | null
  tabelaPrecoId?: string
  formaPagamentoId?: string
  prazoPagamentoId?: string
  formaPagamento?: string
  condicaoPagamento: string
  observacoes: string
  itens: ItemCarrinho[]
}): Promise<OrcamentoSalvo> {
  const subtotal = params.itens.reduce((acc, it) => acc + it.quantidade * it.precoUnitarioCobrado, 0)
  const descontoTotal = params.itens.reduce(
    (acc, it) => acc + it.quantidade * it.precoUnitarioCobrado * ((it.descontoPct || 0) / 100),
    0
  )
  const valorTotal = Math.max(0, subtotal - descontoTotal)
  const descontoPercentual = subtotal > 0 ? Number(((descontoTotal / subtotal) * 100).toFixed(2)) : 0
  const now = new Date().toISOString()
  const numero = `ORC-${String(Date.now()).slice(-5)}`
  const empresaId = params.empresaId || getActiveEmpresaId()

  let serverPedidoId: string | undefined
  let serverNumero = numero
  let pendingLocalId: string | undefined

  // Se houver cliente selecionado, tenta salvar no banco como status='orcamento' ou enfileira offline
  if (params.cliente?.id) {
    const payload: CriarPedidoPayload = {
      clienteId: params.cliente.id,
      empresaId,
      tabelaPrecoId: params.tabelaPrecoId,
      formaPagamentoId: params.formaPagamentoId,
      prazoPagamentoId: params.prazoPagamentoId,
      formaPagamento: params.formaPagamento,
      condicaoPagamento: params.condicaoPagamento,
      status: 'orcamento',
      descontoValor: Number(descontoTotal.toFixed(2)),
      descontoPercentual,
      observacoes: params.observacoes.trim() || undefined,
      itens: params.itens.map((it) => ({
        produtoId: it.produtoId,
        quantidade: it.quantidade,
        precoUnitario: it.precoUnitarioCobrado,
        descontoPct: it.descontoPct || 0,
      })),
    }

    if (navigator.onLine) {
      try {
        const res = await fetchWithAuth('/api/pedidos', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
        if (res?.pedido?.id) {
          serverPedidoId = res.pedido.id
          serverNumero = res.pedido.numero || numero
        }
      } catch (e) {
        if (isNetworkOfflineError(e)) {
          pendingLocalId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
          const queue = await getPendingOfflineOrders()
          const entry = buildPendingOrderEntry(payload, {
            localId: pendingLocalId,
            empresaId,
            clienteNome: params.cliente.nome_fantasia || params.cliente.razao_social,
            totalEstimado: valorTotal,
            descontoValor: Number(descontoTotal.toFixed(2)),
            descontoPercentual,
            itensResumo: params.itens.map((it) => ({
              nome: it.nome,
              codigo: it.codigo,
              unidade: it.unidade,
              quantidade: it.quantidade,
              precoUnitario: it.precoUnitarioCobrado,
              descontoPct: it.descontoPct || 0,
            })),
          })
          await set(PENDING_QUEUE_KEY, [entry, ...queue])
        } else {
          console.warn('Orçamento salvo localmente (sem sincronizar com servidor):', e)
        }
      }
    } else {
      pendingLocalId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`
      const queue = await getPendingOfflineOrders()
      const entry = buildPendingOrderEntry(payload, {
        localId: pendingLocalId,
        empresaId,
        clienteNome: params.cliente.nome_fantasia || params.cliente.razao_social,
        totalEstimado: valorTotal,
        descontoValor: Number(descontoTotal.toFixed(2)),
        descontoPercentual,
        itensResumo: params.itens.map((it) => ({
          nome: it.nome,
          codigo: it.codigo,
          unidade: it.unidade,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitarioCobrado,
          descontoPct: it.descontoPct || 0,
        })),
      })
      await set(PENDING_QUEUE_KEY, [entry, ...queue])
    }
  }

  const orcamento: OrcamentoSalvo = {
    id: params.id || serverPedidoId || `orc_${Date.now()}`,
    numero: serverNumero,
    pedidoId: serverPedidoId,
    pendingLocalId,
    empresaId,
    vendedorId: getActiveUserId(),
    cliente: params.cliente,
    tabelaPrecoId: params.tabelaPrecoId,
    formaPagamentoId: params.formaPagamentoId,
    prazoPagamentoId: params.prazoPagamentoId,
    formaPagamento: params.formaPagamento,
    condicaoPagamento: params.condicaoPagamento,
    observacoes: params.observacoes,
    itens: params.itens,
    subtotal,
    descontoTotal,
    valorTotal,
    createdAt: now,
    updatedAt: now,
  }

  const atuais = getOrcamentosLocais().filter((o) => o.id !== orcamento.id)
  setOrcamentosLocais([orcamento, ...atuais])
  return orcamento
}

export async function removerOrcamento(id: string, pedidoId?: string): Promise<void> {
  const todos = getOrcamentosLocais()
  const alvo = todos.find((o) => o.id === id || o.pedidoId === id)
  const atuais = todos.filter((o) => o.id !== id && o.pedidoId !== id)
  setOrcamentosLocais(atuais)

  if (alvo?.pendingLocalId) {
    await removePendingOfflineOrder(alvo.pendingLocalId)
  }

  const targetServerId = pedidoId || (id.startsWith('orc_') ? undefined : id)
  if (targetServerId && navigator.onLine) {
    try {
      await fetchWithAuth(`/api/pedidos/${targetServerId}`, { method: 'DELETE' })
    } catch {
      // ignora caso já tenha sido removido
    }
  }
}

export async function converterOrcamentoNoServidor(pedidoId: string): Promise<Pedido | null> {
  const data = await fetchWithAuth(`/api/pedidos/${pedidoId}/converter`, {
    method: 'POST',
  })
  const atuais = getOrcamentosLocais().filter((o) => o.id !== pedidoId && o.pedidoId !== pedidoId)
  setOrcamentosLocais(atuais)
  return data?.pedido || null
}

// 7. Dados do Vendedor Autenticado (online-first, fallback offline em erro de rede)
export async function getMe(): Promise<any> {
  try {
    const data = await fetchWithAuth('/api/auth/me')
    if (data) {
      await set('offline_me', data)
      if (data.user?.id) {
        setActiveUserId(data.user.id)
      }
      const empresaId = data.empresaAtiva?.empresa_id || data.empresaAtiva?.id
      if (empresaId) {
        setActiveEmpresaId(empresaId)
      }
    }
    return data
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = await get<any>('offline_me')
      return cached || null
    }
    throw err
  }
}

// 8. Pedidos do Vendedor (online-first, fallback offline SOMENTE em erro de rede)
export async function getPedidos(status?: string): Promise<Pedido[]> {
  try {
    const url =
      status && status !== 'todos'
        ? `/api/pedidos?vendedorId=me&status=${encodeURIComponent(status)}`
        : '/api/pedidos?vendedorId=me'
    const data = await fetchWithAuth(url)
    const list: Pedido[] = data.pedidos || []
    if (!status || status === 'todos') {
      await set('offline_pedidos', list)
    }
    return list
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = (await get<Pedido[]>('offline_pedidos')) || []
      if (status && status !== 'todos') {
        return cached.filter((p) => p.status === status)
      }
      return cached
    }
    throw err
  }
}

export async function getPedidoDetalhes(id: string): Promise<Pedido | null> {
  try {
    const data = await fetchWithAuth(`/api/pedidos/${id}`)
    return data.pedido || null
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = (await get<Pedido[]>('offline_pedidos')) || []
      return cached.find((p) => p.id === id) || null
    }
    return null
  }
}

export async function excluirPedidoNaoTransmitido(id: string): Promise<void> {
  await fetchWithAuth(`/api/pedidos/${id}`, { method: 'DELETE' })
  const atuais = getOrcamentosLocais().filter((o) => o.id !== id && o.pedidoId !== id)
  setOrcamentosLocais(atuais)
}

export async function cancelarPedido(id: string): Promise<Pedido | null> {
  const data = await fetchWithAuth(`/api/pedidos/${id}/cancelar`, {
    method: 'POST',
  })
  return data?.pedido || null
}

// 9. Meta e Desempenho do Vendedor (online-first, fallback offline SOMENTE em erro de rede)
export async function getVendedorMeta(): Promise<VendedorMeta | null> {
  try {
    const data = await fetchWithAuth('/api/vendedor/meta')
    if (data && data.meta) {
      await set('offline_vendedor_meta', data.meta)
      return data.meta
    }
    return null
  } catch (err) {
    if (isNetworkOfflineError(err)) {
      const cached = await get<VendedorMeta>('offline_vendedor_meta')
      return cached || null
    }
    throw err
  }
}

// 10. Cadastro e Atualização de Cliente (vinculado ao vendedor e sincronizado com ERP)
export async function getClienteDetalhes(id: string): Promise<Cliente | null> {
  const data = await fetchWithAuth(`/api/clientes/${id}`)
  if (!data || !data.cliente) return null
  const clientes = (await get<Cliente[]>('offline_clientes')) || []
  const updated = clientes.some((c) => c.id === data.cliente.id)
    ? clientes.map((c) => (c.id === data.cliente.id ? { ...c, ...data.cliente } : c))
    : [data.cliente, ...clientes]
  await set('offline_clientes', updated)
  return data.cliente
}

export async function criarCliente(payload: NovoClientePayload): Promise<Cliente> {
  const data = await fetchWithAuth('/api/clientes', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  if (!data || !data.cliente) {
    throw new Error(data?.error || 'Erro ao cadastrar cliente')
  }

  const clientes = (await get<Cliente[]>('offline_clientes')) || []
  const updated = [data.cliente, ...clientes.filter((c) => c.id !== data.cliente.id)]
  await set('offline_clientes', updated)

  return data.cliente
}

export async function atualizarCliente(id: string, payload: Partial<NovoClientePayload>): Promise<Cliente> {
  const data = await fetchWithAuth(`/api/clientes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  if (!data || !data.cliente) {
    throw new Error(data?.error || 'Erro ao atualizar cliente')
  }

  const clientes = (await get<Cliente[]>('offline_clientes')) || []
  const updated = [data.cliente, ...clientes.filter((c) => c.id !== data.cliente.id)]
  await set('offline_clientes', updated)

  return data.cliente
}

export interface CnpjLookupDados {
  cnpj: string
  razao_social: string
  nome_fantasia?: string
  inscricao_estadual?: string
  email?: string
  telefone?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  source?: string
}

export async function consultarCnpj(cnpj: string): Promise<CnpjLookupDados | null> {
  const digits = cnpj.replace(/\D/g, '')
  if (digits.length !== 14) return null

  try {
    const data = await fetchWithAuth(`/api/consulta-cnpj/${digits}`)
    if (data && data.ok && data.dados) {
      return data.dados as CnpjLookupDados
    }
  } catch {
    // Fallback direto na BrasilAPI se o servidor estiver offline ou indisponível
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/cnpj/v1/${digits}`)
    if (!res.ok) return null
    const m = await res.json()
    if (!m || !m.razao_social) return null
    return {
      cnpj: digits,
      razao_social: m.razao_social || '',
      nome_fantasia: m.nome_fantasia || '',
      email: (m.email || '').toLowerCase(),
      telefone: (m.ddd_telefone_1 || '').replace(/\D/g, ''),
      cep: (m.cep || '').replace(/\D/g, ''),
      logradouro: m.logradouro || '',
      numero: m.numero || '',
      complemento: m.complemento || '',
      bairro: m.bairro || '',
      cidade: m.municipio || '',
      estado: (m.uf || '').toUpperCase(),
      source: 'brasilapi',
    }
  } catch {
    return null
  }
}

// 11. Atualização de Perfil e PIN de Segurança do Vendedor
export async function updateVendedorPerfil(dados: {
  nome?: string
  email?: string
  telefone?: string
  pin?: string
}): Promise<{ ok: boolean; message?: string; user?: UsuarioVendedor }> {
  const data = await fetchWithAuth('/api/vendedor/perfil', {
    method: 'PUT',
    body: JSON.stringify(dados),
  })
  return data
}
