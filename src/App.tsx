import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Header } from './components/Header'
import { ProductCard } from './components/ProductCard'
import { CartDrawer } from './components/CartDrawer'
import { ClientSelectModal } from './components/ClientSelectModal'
import { NewClientModal } from './components/NewClientModal'
import { VendedorAuthScreen } from './components/VendedorAuthScreen'
import { DesktopSidebar, MobileBottomNav, TabType } from './components/Navigation'
import { ClientesView } from './components/ClientesView'
import { PedidosView } from './components/PedidosView'
import { MetaView } from './components/MetaView'
import { MaisView } from './components/MaisView'
import { useTheme } from './hooks/useTheme'
import { usePwaInstall } from './hooks/usePwaInstall'
import {
  AuthError,
  checkServerConnectivity,
  getProdutos,
  getCategorias,
  getTabelasPreco,
  getCondicoesPagamento,
  getClientes,
  enviarPedido,
  getMe,
  getToken,
  logoutVendedor,
  selecionarEmpresa,
  getOrcamentosLocais,
  salvarOrcamento,
  getPendingOfflineOrders,
  removePendingOfflineOrder,
  syncPendingOfflineOrders,
} from './services/api'
import type {
  Produto,
  Categoria,
  TabelaPreco,
  Cliente,
  ItemCarrinho,
  OrcamentoSalvo,
  EmpresaVinculo,
  UsuarioVendedor,
  PendingOfflineOrder,
  FormaPagamento,
  PrazoPagamento,
} from './types'
import {
  ChevronRight,
  PackageSearch,
  Loader2,
  CheckCircle2,
  Building2,
  X,
  Bookmark,
  Edit3,
  AlertCircle,
  Share,
  PlusSquare,
  Smartphone,
} from 'lucide-react'

export function App() {
  const { theme, toggleTheme } = useTheme()
  const pwaInstall = usePwaInstall()

  // Autenticação & Sessão
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => !!getToken())
  const [currentUser, setCurrentUser] = useState<UsuarioVendedor | null>(null)
  const [empresaAtiva, setEmpresaAtiva] = useState<EmpresaVinculo | null>(null)
  const [empresasDisponiveis, setEmpresasDisponiveis] = useState<EmpresaVinculo[]>([])
  const [switchModalOpen, setSwitchModalOpen] = useState(false)
  const [switching, setSwitching] = useState(false)
  const [logoutModalOpen, setLogoutModalOpen] = useState(false)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)

  // Aba ativa
  const [activeTab, setActiveTab] = useState<TabType>('produtos')
  const [pedidosInitialFilter, setPedidosInitialFilter] = useState<string>('todos')
  const [autoOpenNewClient, setAutoOpenNewClient] = useState<boolean>(false)

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tabelas, setTabelas] = useState<TabelaPreco[]>([])
  const [formasPagamento, setFormasPagamento] = useState<FormaPagamento[]>([])
  const [prazosPagamento, setPrazosPagamento] = useState<PrazoPagamento[]>([])
  const [selectedTabelaId, setSelectedTabelaId] = useState<string>('')
  const selectedTabelaRef = useRef<string>('')
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [orcamentosSalvos, setOrcamentosSalvos] = useState<OrcamentoSalvo[]>(() => getOrcamentosLocais())
  const [pendingOfflineOrders, setPendingOfflineOrders] = useState<PendingOfflineOrder[]>([])
  const [syncingOffline, setSyncingOffline] = useState(false)
  const [syncVersion, setSyncVersion] = useState(0)
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)
  const syncLockRef = useRef(false)
  const lastSyncAtRef = useRef(0)
  const isOfflineRef = useRef(isOffline)
  const fromCacheRef = useRef(fromCache)
  const pendingCountRef = useRef(0)

  // Filtros e Visualização de Catálogo
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [onlyInStock, setOnlyInStock] = useState<boolean>(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  // Carrinho & Pedido
  const [itens, setItens] = useState<ItemCarrinho[]>(() => {
    try {
      const saved = localStorage.getItem('vendedor_carrinho')
      return saved ? JSON.parse(saved) : []
    } catch {
      return []
    }
  })

  const [selectedCliente, setSelectedCliente] = useState<Cliente | null>(() => {
    try {
      const saved = localStorage.getItem('vendedor_cliente')
      return saved ? JSON.parse(saved) : null
    } catch {
      return null
    }
  })

  const [cartOpen, setCartOpen] = useState(false)
  const [clienteModalOpen, setClienteModalOpen] = useState(false)
  const [newClientModalOpen, setNewClientModalOpen] = useState(false)
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState('ThothVendas')

  const showToast = useCallback((msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }, [])

  const refreshPendingOffline = useCallback(async () => {
    const q = await getPendingOfflineOrders()
    setPendingOfflineOrders(q)
  }, [])

  const refreshOrcamentos = useCallback(() => {
    setOrcamentosSalvos(getOrcamentosLocais())
    void refreshPendingOffline()
  }, [refreshPendingOffline])

  useEffect(() => {
    isOfflineRef.current = isOffline
  }, [isOffline])

  useEffect(() => {
    fromCacheRef.current = fromCache
  }, [fromCache])

  useEffect(() => {
    pendingCountRef.current = pendingOfflineOrders.length
  }, [pendingOfflineOrders.length])

  const carregarDados = useCallback(
    async (options?: { forceNetwork?: boolean; silent?: boolean }) => {
      if (!getToken()) {
        setIsAuthenticated(false)
        setLoading(false)
        return
      }

      if (!options?.silent) {
        setLoading(true)
        setErrorBanner(null)
      }
      try {
        const [prodData, cats, tabs, conds, clis, me] = await Promise.all([
          getProdutos(),
          getCategorias(),
          getTabelasPreco(),
          getCondicoesPagamento(),
          getClientes(),
          getMe(),
        ])
        setProdutos(prodData.produtos)
        setFromCache(prodData.fromCache)
        setIsOffline(!navigator.onLine || prodData.fromCache)
        if (!prodData.fromCache) {
          lastSyncAtRef.current = Date.now()
          setSyncVersion((v) => v + 1)
        }
        setCategorias(cats)
        setTabelas(tabs)
        setFormasPagamento(conds.formas)
        setPrazosPagamento(conds.prazos)
        if (tabs.length > 0 && !selectedTabelaRef.current) {
          const padrao = tabs.find((t) => t.padrao) || tabs[0]
          setSelectedTabelaId(padrao.id)
        }
        setClientes(clis)
        setOrcamentosSalvos(getOrcamentosLocais())
        await refreshPendingOffline()

        if (me) {
          setIsAuthenticated(true)
          if (me.user) setCurrentUser(me.user)
          if (me.empresaAtiva) {
            setEmpresaAtiva(me.empresaAtiva)
            setEmpresaNome(me.empresaAtiva.nome_fantasia || me.empresaAtiva.razao_social || 'ThothVendas')
          }
          if (me.empresas && Array.isArray(me.empresas)) {
            setEmpresasDisponiveis(me.empresas)
          }
        }
      } catch (err: any) {
        console.warn('Falha ao carregar dados:', err)
        if (
          err instanceof AuthError ||
          err?.status === 401 ||
          (err?.message && (err.message.includes('401') || err.message.includes('Sessão expirada')))
        ) {
          setIsAuthenticated(false)
        } else if (!options?.silent) {
          setErrorBanner(err?.message || 'Falha ao carregar dados do catálogo.')
        }
      } finally {
        if (!options?.silent) {
          setLoading(false)
        }
      }
    },
    [refreshPendingOffline]
  )

  const handleSyncOffline = useCallback(async () => {
    if (!navigator.onLine || syncLockRef.current) return
    syncLockRef.current = true
    setSyncingOffline(true)
    try {
      const result = await syncPendingOfflineOrders()
      setPendingOfflineOrders(result.remaining)
      setOrcamentosSalvos(getOrcamentosLocais())

      if (result.authExpired) {
        setIsAuthenticated(false)
        return
      }
      if (result.synced > 0) {
        showToast(`${result.synced} pedido(s) offline sincronizado(s) com o ERP!`)
      }
      if (result.failed > 0) {
        setErrorBanner(`${result.failed} pedido(s) offline falharam ao sincronizar. Verifique em Pedidos.`)
      }
      await carregarDados({ forceNetwork: true, silent: true })
    } finally {
      syncLockRef.current = false
      setSyncingOffline(false)
    }
  }, [carregarDados, showToast])

  useEffect(() => {
    selectedTabelaRef.current = selectedTabelaId
  }, [selectedTabelaId])

  useEffect(() => {
    localStorage.setItem('vendedor_carrinho', JSON.stringify(itens))
  }, [itens])

  useEffect(() => {
    if (selectedCliente) {
      localStorage.setItem('vendedor_cliente', JSON.stringify(selectedCliente))
      if (selectedCliente.tabela_preco_id) {
        setSelectedTabelaId(selectedCliente.tabela_preco_id)
      }
    } else {
      localStorage.removeItem('vendedor_cliente')
    }
  }, [selectedCliente])

  useEffect(() => {
    const handleOnline = () => {
      setIsOffline(false)
      if (!getToken()) return
      if (pendingCountRef.current > 0) {
        void handleSyncOffline()
      } else {
        void carregarDados({ forceNetwork: true, silent: true })
      }
    }
    const handleOffline = () => setIsOffline(true)
    const handleVisibilityChange = () => {
      if (document.visibilityState !== 'visible' || !navigator.onLine || !getToken()) return
      if (pendingCountRef.current > 0) {
        void handleSyncOffline()
      } else if (
        isOfflineRef.current ||
        fromCacheRef.current ||
        Date.now() - lastSyncAtRef.current > 30000
      ) {
        void carregarDados({ forceNetwork: true, silent: true })
      }
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [handleSyncOffline, carregarDados])

  // Verificação periódica de conectividade apenas quando há fila offline ou cache ativo
  useEffect(() => {
    if (!isAuthenticated) return
    if (pendingOfflineOrders.length === 0 && !isOffline && !fromCache) return

    const intervalId = window.setInterval(async () => {
      if (!navigator.onLine || !getToken() || syncLockRef.current) return
      const reachable = await checkServerConnectivity()
      if (!reachable) return

      setIsOffline(false)
      if (pendingCountRef.current > 0) {
        await handleSyncOffline()
      } else if (fromCacheRef.current || isOfflineRef.current) {
        await carregarDados({ forceNetwork: true, silent: true })
      }
    }, 15000)

    return () => window.clearInterval(intervalId)
  }, [isAuthenticated, pendingOfflineOrders.length, isOffline, fromCache, handleSyncOffline, carregarDados])

  useEffect(() => {
    carregarDados({ forceNetwork: true })
  }, [carregarDados])

  const handleAuthSuccess = (empresa: EmpresaVinculo, user: UsuarioVendedor, empresas: EmpresaVinculo[]) => {
    setIsAuthenticated(true)
    setEmpresaAtiva(empresa)
    setCurrentUser(user)
    setEmpresasDisponiveis(empresas)
    setEmpresaNome(empresa.nome_fantasia || empresa.razao_social || 'ThothVendas')
    void carregarDados({ forceNetwork: true }).then(() => {
      if (pendingCountRef.current > 0 && navigator.onLine) {
        void handleSyncOffline()
      }
    })
  }

  const handleTrocarEmpresa = async (empresa: EmpresaVinculo) => {
    const empresaId = empresa.empresa_id || empresa.id || ''
    if (!empresaId) return
    setSwitching(true)
    try {
      const res = await selecionarEmpresa(empresaId)
      setEmpresaAtiva(res.empresaAtiva || empresa)
      setEmpresaNome(empresa.nome_fantasia || empresa.razao_social)
      setSwitchModalOpen(false)
      setItens([])
      setSelectedCliente(null)
      setProdutos([])
      setClientes([])
      selectedTabelaRef.current = ''
      setSelectedTabelaId('')
      await carregarDados({ forceNetwork: true })
      showToast(`Empresa alterada para ${empresa.nome_fantasia || empresa.razao_social}`)
    } catch (err: any) {
      setErrorBanner(`Erro ao alternar de empresa: ${err.message || err}`)
    } finally {
      setSwitching(false)
    }
  }

  const handleSelectTabela = (novaTabelaId: string) => {
    setSelectedTabelaId(novaTabelaId)
    const tabela = tabelas.find((t) => t.id === novaTabelaId)
    if (!tabela) return

    setItens((prev) =>
      prev.map((it) => {
        const precoBase = it.precoUnitarioTabela
        let precoCobrado = precoBase
        if (tabela.tipo_ajuste === 'acrescimo_pct') {
          precoCobrado = precoBase * (1 + tabela.percentual_ajuste / 100)
        } else if (tabela.tipo_ajuste === 'desconto_pct') {
          precoCobrado = precoBase * (1 - tabela.percentual_ajuste / 100)
        }
        const sub = it.quantidade * precoCobrado
        return {
          ...it,
          tabelaPrecoId: novaTabelaId,
          precoUnitarioCobrado: precoCobrado,
          subtotal: sub * (1 - (it.descontoPct || 0) / 100),
        }
      })
    )
  }

  const handleAddToCart = (produto: Produto, quantidade: number, tabelaId?: string) => {
    const tabId = tabelaId || selectedTabelaId
    const tabela = tabelas.find((t) => t.id === tabId)
    const precoBase = Number(produto.preco_tabela) || 0
    let precoCobrado = precoBase
    if (tabela) {
      if (tabela.tipo_ajuste === 'acrescimo_pct') {
        precoCobrado = precoBase * (1 + tabela.percentual_ajuste / 100)
      } else if (tabela.tipo_ajuste === 'desconto_pct') {
        precoCobrado = precoBase * (1 - tabela.percentual_ajuste / 100)
      }
    }

    setItens((prev) => {
      const idx = prev.findIndex((it) => it.produtoId === produto.id)
      if (idx >= 0) {
        const copy = [...prev]
        const newQty = copy[idx].quantidade + quantidade
        const descPct = copy[idx].descontoPct || 0
        const sub = newQty * precoCobrado
        copy[idx] = {
          ...copy[idx],
          precoUnitarioCobrado: precoCobrado,
          tabelaPrecoId: tabId,
          quantidade: newQty,
          subtotal: sub * (1 - descPct / 100),
        }
        return copy
      }
      return [
        ...prev,
        {
          produtoId: produto.id,
          codigo: produto.codigo,
          nome: produto.nome,
          unidade: produto.unidade,
          quantidade,
          precoUnitarioTabela: precoBase,
          precoUnitarioCobrado: precoCobrado,
          tabelaPrecoId: tabId,
          descontoPct: 0,
          subtotal: quantidade * precoCobrado,
          imagemUrl: produto.imagem_url,
        },
      ]
    })
    showToast(`+${quantidade} ${produto.nome.slice(0, 26)} adicionado`)
  }

  const handleUpdateQty = (produtoId: string, quantidade: number) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.produtoId === produtoId) {
          const sub = quantidade * it.precoUnitarioCobrado
          const desc = sub * ((it.descontoPct || 0) / 100)
          return {
            ...it,
            quantidade,
            subtotal: sub - desc,
          }
        }
        return it
      })
    )
  }

  const handleUpdateDesconto = (produtoId: string, descontoPct: number) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.produtoId === produtoId) {
          const sub = it.quantidade * it.precoUnitarioCobrado
          const desc = sub * (descontoPct / 100)
          return {
            ...it,
            descontoPct,
            subtotal: sub - desc,
          }
        }
        return it
      })
    )
  }

  const handleRemoveItem = (produtoId: string) => {
    setItens((prev) => prev.filter((it) => it.produtoId !== produtoId))
  }

  const handleClearCart = () => {
    setItens([])
    showToast('Carrinho limpo')
  }

  const handleSaveOrcamento = async (
    observacoes: string,
    condicao: string,
    formaPagamento: string,
    formaPagamentoId?: string,
    prazoPagamentoId?: string
  ) => {
    if (itens.length === 0) return
    try {
      const orc = await salvarOrcamento({
        empresaId: activeEmpresaId,
        cliente: selectedCliente,
        tabelaPrecoId: selectedTabelaId || itens[0]?.tabelaPrecoId,
        formaPagamentoId,
        prazoPagamentoId,
        formaPagamento,
        condicaoPagamento: condicao,
        observacoes,
        itens,
      })
      refreshOrcamentos()
      setItens([])
      setCartOpen(false)
      showToast(
        orc.pendingLocalId
          ? `Orçamento ${orc.numero} salvo offline e será sincronizado ao reconectar!`
          : `Orçamento ${orc.numero} salvo com sucesso!`
      )
    } catch (err: any) {
      setErrorBanner(`Erro ao salvar orçamento: ${err.message || err}`)
      throw err
    }
  }

  const handleRestoreOrcamento = (orc: OrcamentoSalvo) => {
    if (orc.cliente && orc.cliente.id) {
      const cliCompleto = clientes.find((c) => c.id === orc.cliente?.id) || orc.cliente
      setSelectedCliente(cliCompleto)
    } else {
      setSelectedCliente(null)
    }
    if (orc.tabelaPrecoId) {
      setSelectedTabelaId(orc.tabelaPrecoId)
    }
    setItens(orc.itens)
    setActiveTab('produtos')
    setCartOpen(true)
    showToast(`Orçamento ${orc.numero} carregado no carrinho!`)
  }

  const handleSubmitOrder = async (
    observacoes: string,
    condicao: string,
    formaPagamento: string,
    formaPagamentoId?: string,
    prazoPagamentoId?: string
  ) => {
    if (!selectedCliente) return
    setIsSubmitting(true)
    try {
      const brutoTotal = itens.reduce((acc, it) => acc + it.quantidade * it.precoUnitarioCobrado, 0)
      const descontoValor = Number(
        itens
          .reduce(
            (acc, it) => acc + it.quantidade * it.precoUnitarioCobrado * ((it.descontoPct || 0) / 100),
            0
          )
          .toFixed(2)
      )
      const descontoPercentual =
        brutoTotal > 0 ? Number(((descontoValor / brutoTotal) * 100).toFixed(2)) : 0

      const payload = {
        clienteId: selectedCliente.id,
        empresaId: activeEmpresaId,
        tabelaPrecoId: selectedTabelaId || itens[0]?.tabelaPrecoId,
        formaPagamentoId,
        prazoPagamentoId,
        formaPagamento,
        condicaoPagamento: condicao,
        status: 'pendente' as const,
        descontoValor,
        descontoPercentual,
        observacoes: observacoes.trim() || undefined,
        itens: itens.map((it) => ({
          produtoId: it.produtoId,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitarioCobrado,
          descontoPct: it.descontoPct || 0,
        })),
      }
      const res = await enviarPedido(payload, {
        empresaId: activeEmpresaId,
        clienteNome: selectedCliente.nome_fantasia || selectedCliente.razao_social,
        totalEstimado: cartTotal,
        descontoValor,
        descontoPercentual,
        permitirOffline: empresaAtiva?.permitir_pedido_offline ?? true,
        itensResumo: itens.map((it) => ({
          nome: it.nome,
          codigo: it.codigo,
          unidade: it.unidade,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitarioCobrado,
          descontoPct: it.descontoPct || 0,
        })),
      })
      if (res.offlineQueued) {
        await refreshPendingOffline()
        showToast('Pedido gravado na fila offline e será enviado ao reconectar!')
      } else {
        showToast('Pedido emitido e transmitido ao ERP!')
        void carregarDados({ forceNetwork: true, silent: true })
      }
      setItens([])
      setCartOpen(false)
      setPedidosInitialFilter('todos')
      setActiveTab('pedidos')
    } catch (err: any) {
      setErrorBanner(`Falha ao emitir pedido: ${err.message || err}`)
      throw err
    } finally {
      setIsSubmitting(false)
    }
  }

  const cartQtyMap = useMemo(() => {
    const map: Record<string, number> = {}
    for (const it of itens) {
      map[it.produtoId] = (map[it.produtoId] || 0) + it.quantidade
    }
    return map
  }, [itens])

  const filteredProducts = useMemo(() => {
    return produtos.filter((p) => {
      if (onlyInStock && (p.estoque_atual || 0) <= 0) return false
      if (selectedCategory && p.categoria_id !== selectedCategory) return false
      if (!search.trim()) return true
      const term = search.toLowerCase().trim()
      return (
        p.nome.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        (p.codigo_barras && p.codigo_barras.toLowerCase().includes(term)) ||
        (p.categoria_nome && p.categoria_nome.toLowerCase().includes(term))
      )
    })
  }, [produtos, selectedCategory, search, onlyInStock])

  const cartTotal = itens.reduce((acc, it) => acc + it.subtotal, 0)
  const cartCount = itens.reduce((acc, it) => acc + it.quantidade, 0)
  const cartTotalFmt = cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  const companyDescontoMax = empresaAtiva?.desconto_maximo_vendedor_pct ?? 15
  const userDescontoMax = currentUser?.limite_desconto_pct
  const limiteDescontoEfetivo =
    userDescontoMax !== undefined &&
    userDescontoMax !== null &&
    userDescontoMax > 0 &&
    (userDescontoMax !== 15 || companyDescontoMax === 15)
      ? userDescontoMax
      : companyDescontoMax
  const activeEmpresaId = empresaAtiva?.empresa_id || empresaAtiva?.id

  if (!isAuthenticated) {
    return <VendedorAuthScreen onSuccess={handleAuthSuccess} />
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-[#F8FAFC] dark:bg-[#090D16] flex flex-col md:flex-row">
      {/* Barra Lateral no Desktop */}
      <DesktopSidebar
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'pedidos') setPedidosInitialFilter('todos')
          setActiveTab(tab)
        }}
        storeName={empresaNome}
        currentUser={currentUser}
        empresaAtiva={empresaAtiva}
        empresasCount={empresasDisponiveis.length}
        cartCount={cartCount}
        cartTotal={cartTotal}
        orcamentosCount={orcamentosSalvos.length}
        onOpenCart={() => setCartOpen(true)}
        onSwitchEmpresa={() => setSwitchModalOpen(true)}
        onLogout={() => setLogoutModalOpen(true)}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Área Central */}
      <div
        className={`flex-1 md:pl-[260px] min-w-0 w-full flex flex-col min-h-screen ${
          cartCount > 0 && activeTab === 'produtos' ? 'pb-36 md:pb-8' : 'pb-20 md:pb-8'
        }`}
      >
        {errorBanner && (
          <div className="mx-auto max-w-6xl w-full px-3 sm:px-6 pt-3">
            <div
              role="alert"
              className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between gap-2"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorBanner}</span>
              </div>
              <button type="button" onClick={() => setErrorBanner(null)} aria-label="Fechar alerta">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}

        {/* ABA: PRODUTOS */}
        {activeTab === 'produtos' && (
          <>
            <Header
              storeName={empresaNome}
              vendedorNome={currentUser?.nome}
              empresasCount={empresasDisponiveis.length}
              onSwitchEmpresa={() => setSwitchModalOpen(true)}
              onLogout={() => setLogoutModalOpen(true)}
              search={search}
              setSearch={setSearch}
              categories={categorias}
              selectedCategory={selectedCategory}
              setSelectedCategory={setSelectedCategory}
              cartCount={cartCount}
              cartTotal={cartTotal}
              onOpenCart={() => setCartOpen(true)}
              isOffline={isOffline}
              pendingOfflineCount={pendingOfflineOrders.length}
              syncingOffline={syncingOffline}
              onSyncOffline={handleSyncOffline}
              selectedCliente={selectedCliente}
              onOpenClienteSelect={() => setClienteModalOpen(true)}
              tabelas={tabelas}
              selectedTabelaId={selectedTabelaId}
              onSelectTabela={handleSelectTabela}
              onlyInStock={onlyInStock}
              onToggleInStock={() => setOnlyInStock((prev) => !prev)}
              viewMode={viewMode}
              onChangeViewMode={setViewMode}
              orcamentosCount={orcamentosSalvos.length}
              onOpenOrcamentos={() => {
                setPedidosInitialFilter('orcamentos')
                setActiveTab('pedidos')
              }}
              theme={theme}
              onToggleTheme={toggleTheme}
              canInstallApp={pwaInstall.showBanner}
              onInstallApp={() => {
                void pwaInstall.promptInstall()
              }}
              onDismissInstall={pwaInstall.dismissBanner}
            />

            <main className="mx-auto max-w-6xl w-full px-3 py-3 sm:px-6 sm:py-5 flex-1">
              {orcamentosSalvos.length > 0 && (
                <div className="mb-3 rounded-xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/90 dark:bg-amber-500/10 px-3.5 py-2.5 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <Bookmark className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
                    <div className="min-w-0 text-xs">
                      <span className="font-bold text-amber-900 dark:text-amber-200 font-mono tabular-nums">
                        {orcamentosSalvos.length} orçamento(s) salvo(s)
                      </span>
                      <span className="hidden sm:inline text-amber-800 dark:text-amber-300 ml-1.5 font-mono tabular-nums">
                        • Último: {orcamentosSalvos[0].cliente?.razao_social || orcamentosSalvos[0].numero} (
                        {orcamentosSalvos[0].valorTotal.toLocaleString('pt-BR', {
                          style: 'currency',
                          currency: 'BRL',
                        })}
                        )
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleRestoreOrcamento(orcamentosSalvos[0])}
                      className="flex items-center gap-1 rounded-lg bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-500/30 px-2.5 py-1 text-[11px] font-semibold text-amber-800 dark:text-amber-300 hover:bg-amber-100/50"
                    >
                      <Edit3 className="h-3 w-3" />
                      <span>Reabrir</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPedidosInitialFilter('orcamentos')
                        setActiveTab('pedidos')
                      }}
                      className="rounded-lg bg-amber-500 px-2.5 py-1 text-[11px] font-semibold text-slate-950 hover:bg-amber-400"
                    >
                      Ver todos
                    </button>
                  </div>
                </div>
              )}

              <div className="mb-2.5 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 px-0.5">
                <span className="font-mono tabular-nums">
                  <strong className="text-slate-800 dark:text-slate-200">{filteredProducts.length}</strong> produto(s)
                  {fromCache ? ' • modo offline' : ''}
                </span>
                <span className="text-[11px] font-mono tabular-nums font-semibold text-[#00A19C] bg-[#00A19C]/10 px-2.5 py-0.5 rounded-full border border-[#00A19C]/20">
                  Desc. máx: {limiteDescontoEfetivo}%
                </span>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-[#00A19C] mb-2" />
                  <p className="text-xs">Carregando catálogo de produtos…</p>
                </div>
              ) : filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 text-center px-4">
                  <PackageSearch className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
                  <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Nenhum produto encontrado
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    Tente ajustar a busca, trocar de categoria ou desativar o filtro de estoque
                  </p>
                </div>
              ) : viewMode === 'list' ? (
                <div className="space-y-2">
                  {filteredProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      produto={p}
                      tabelas={tabelas}
                      tabelaAtivaId={selectedTabelaId}
                      cartQty={cartQtyMap[p.id] || 0}
                      viewMode="list"
                      bloquearSemEstoque={empresaAtiva?.bloquear_venda_sem_estoque}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2.5 sm:gap-3.5 sm:grid-cols-3 lg:grid-cols-4">
                  {filteredProducts.map((p) => (
                    <ProductCard
                      key={p.id}
                      produto={p}
                      tabelas={tabelas}
                      tabelaAtivaId={selectedTabelaId}
                      cartQty={cartQtyMap[p.id] || 0}
                      viewMode="grid"
                      bloquearSemEstoque={empresaAtiva?.bloquear_venda_sem_estoque}
                      onAddToCart={handleAddToCart}
                    />
                  ))}
                </div>
              )}
            </main>

            {/* Barra Flutuante Mobile */}
            {cartCount > 0 && (
              <div className="fixed bottom-[calc(3.75rem+env(safe-area-inset-bottom))] left-2 right-2 z-20 rounded-xl border border-[#00A19C]/30 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md px-4 py-2.5 shadow-xl md:hidden">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                      Pedido em andamento ({cartCount} un.)
                    </div>
                    <div className="font-display font-mono tabular-nums text-base font-bold text-[#00A19C] truncate">
                      {cartTotalFmt}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setCartOpen(true)}
                    className="flex items-center gap-1 rounded-xl bg-[#00A19C] px-4 py-2 text-xs font-semibold text-white shadow-xs active:scale-95 shrink-0"
                  >
                    <span>Concluir / Orçar</span>
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* ABA: CLIENTES */}
        {activeTab === 'clientes' && (
          <ClientesView
            clientes={clientes}
            selectedCliente={selectedCliente}
            isOffline={isOffline}
            onRefresh={() => carregarDados({ forceNetwork: true })}
            onNewClient={() => {
              setEditingCliente(null)
              setNewClientModalOpen(true)
            }}
            onEditClient={(c) => {
              setEditingCliente(c)
              setNewClientModalOpen(true)
            }}
            onSelectForOrder={(c) => {
              setSelectedCliente(c)
              setActiveTab('produtos')
              showToast(`Cliente ${c.razao_social} selecionado para o pedido!`)
            }}
            onClientLoaded={(fresh) => {
              setClientes((prev) => prev.map((item) => (item.id === fresh.id ? { ...item, ...fresh } : item)))
              setSelectedCliente((prev) => (prev?.id === fresh.id ? { ...prev, ...fresh } : prev))
            }}
            onNotify={showToast}
          />
        )}

        {/* ABA: PEDIDOS E ORÇAMENTOS */}
        {activeTab === 'pedidos' && (
          <PedidosView
            empresaNome={empresaNome}
            orcamentosLocais={orcamentosSalvos}
            pendingOfflineOrders={pendingOfflineOrders}
            syncingOffline={syncingOffline}
            isOffline={isOffline}
            syncVersion={syncVersion}
            onSyncOffline={handleSyncOffline}
            onRemoveOfflineOrder={async (localId) => {
              await removePendingOfflineOrder(localId)
              await refreshPendingOffline()
            }}
            onRefreshOrcamentos={refreshOrcamentos}
            onRestoreOrcamento={handleRestoreOrcamento}
            initialFilter={pedidosInitialFilter}
            onNotify={showToast}
          />
        )}

        {/* ABA: META */}
        {activeTab === 'meta' && <MetaView vendedorNome={currentUser?.nome} syncVersion={syncVersion} />}

        {/* ABA: AJUSTES */}
        {activeTab === 'mais' && (
          <MaisView
            currentUser={currentUser}
            onUpdateUser={(u) => setCurrentUser((prev) => (prev ? { ...prev, ...u } : u))}
            clientes={clientes}
            tabelas={tabelas}
            onClienteCreated={(c) => {
              setClientes((prev) => [c, ...prev])
              setSelectedCliente(c)
              showToast(`Cliente ${c.razao_social} cadastrado e selecionado!`)
            }}
            onSelectClienteForOrder={(c) => {
              setSelectedCliente(c)
              setActiveTab('produtos')
              showToast(`Cliente ${c.razao_social} selecionado!`)
            }}
            empresaAtiva={empresaAtiva}
            empresasCount={empresasDisponiveis.length}
            onSwitchEmpresa={() => setSwitchModalOpen(true)}
            onLogout={() => setLogoutModalOpen(true)}
            onReloadData={() => carregarDados({ forceNetwork: true })}
            autoOpenNewClient={autoOpenNewClient}
            onClearAutoOpenNewClient={() => setAutoOpenNewClient(false)}
            theme={theme}
            onToggleTheme={toggleTheme}
            isOffline={isOffline}
            canInstallApp={pwaInstall.canInstall}
            isAppInstalled={pwaInstall.isStandalone}
            onInstallApp={() => {
              void pwaInstall.promptInstall()
            }}
          />
        )}
      </div>

      {/* Barra Inferior Mobile */}
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={(tab) => {
          if (tab === 'pedidos') setPedidosInitialFilter('todos')
          setActiveTab(tab)
        }}
        cartCount={cartCount}
        orcamentosCount={orcamentosSalvos.length}
      />

      {/* Drawer do Carrinho */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        itens={itens}
        onUpdateQty={handleUpdateQty}
        onUpdateDesconto={handleUpdateDesconto}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        selectedCliente={selectedCliente}
        onOpenClienteSelect={() => setClienteModalOpen(true)}
        onClearCliente={() => setSelectedCliente(null)}
        onSubmitOrder={handleSubmitOrder}
        onSaveOrcamento={handleSaveOrcamento}
        isSubmitting={isSubmitting}
        limiteDescontoPct={limiteDescontoEfetivo}
        valorPedidoMinimo={empresaAtiva?.valor_pedido_minimo || 0}
        empresaNome={empresaNome}
        formasPagamento={formasPagamento}
        prazosPagamento={prazosPagamento}
      />

      {/* Modal de Seleção de Cliente */}
      <ClientSelectModal
        isOpen={clienteModalOpen}
        onClose={() => setClienteModalOpen(false)}
        clientes={clientes}
        selectedCliente={selectedCliente}
        onSelect={(c) => {
          setSelectedCliente(c)
          setClienteModalOpen(false)
        }}
        onClear={() => {
          setSelectedCliente(null)
          setClienteModalOpen(false)
        }}
        onNewClient={() => {
          setClienteModalOpen(false)
          setEditingCliente(null)
          setNewClientModalOpen(true)
        }}
      />

      {/* Modal Rápido de Cadastro / Edição de Cliente */}
      <NewClientModal
        isOpen={newClientModalOpen}
        onClose={() => {
          setNewClientModalOpen(false)
          setEditingCliente(null)
        }}
        tabelas={tabelas}
        editingCliente={editingCliente}
        onCreated={(c) => {
          setClientes((prev) => [c, ...prev.filter((item) => item.id !== c.id)])
          setSelectedCliente(c)
          showToast(`Cliente ${c.razao_social} cadastrado e selecionado!`)
        }}
        onUpdated={(c) => {
          setClientes((prev) => prev.map((item) => (item.id === c.id ? { ...item, ...c } : item)))
          setSelectedCliente((prev) => (prev?.id === c.id ? { ...prev, ...c } : prev))
          showToast(`Dados de ${c.razao_social} atualizados e enviados ao ERP!`)
        }}
      />

      {/* Modal de Alternar Empresa */}
      {switchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-[#00A19C]" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Trocar de Empresa
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSwitchModalOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Escolha para qual empresa deseja emitir pedidos agora:
            </p>

            <div className="mt-3 space-y-2">
              {empresasDisponiveis.map((emp) => {
                const empId = emp.empresa_id || emp.id || emp.slug
                const isSelected = activeEmpresaId === empId
                return (
                  <button
                    key={empId}
                    type="button"
                    disabled={switching}
                    onClick={() => handleTrocarEmpresa(emp)}
                    className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                      isSelected
                        ? 'border-[#00A19C] bg-[#00A19C]/10 text-slate-900 dark:text-white font-semibold'
                        : 'border-slate-200/80 dark:border-slate-800 bg-[#F8FAFC] dark:bg-slate-800/50 hover:border-[#00A19C]/50 text-slate-800 dark:text-slate-200'
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-xs truncate">{emp.nome_fantasia || emp.razao_social}</div>
                      {emp.cnpj && (
                        <div className="text-[10px] text-slate-400 font-mono tabular-nums">{emp.cnpj}</div>
                      )}
                    </div>
                    {isSelected && (
                      <span className="text-[10px] bg-[#00A19C] text-white px-2 py-0.5 rounded-full font-semibold">
                        Ativa
                      </span>
                    )}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação de Logout */}
      {logoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Sair do Aplicativo
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300">
              Deseja encerrar a sessão neste aparelho? Orçamentos salvos e fila offline permanecerão protegidos no dispositivo.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setLogoutModalOpen(false)}
                className="rounded-xl border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => logoutVendedor()}
                className="rounded-xl bg-rose-600 hover:bg-rose-700 px-4 py-2 text-xs font-semibold text-white"
              >
                Sair
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Instruções de Instalação iOS Safari */}
      {pwaInstall.iosGuideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200/80 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Smartphone className="h-5 w-5 text-[#00A19C]" />
                <h3 className="font-display font-bold text-sm text-slate-900 dark:text-white">
                  Instalar no iPhone / iPad
                </h3>
              </div>
              <button
                type="button"
                onClick={() => pwaInstall.setIosGuideOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <ol className="space-y-3 text-xs text-slate-600 dark:text-slate-300">
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00A19C]/10 font-bold text-[#00A19C]">
                  1
                </span>
                <span>
                  Toque no botão <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white"><Share className="h-3.5 w-3.5 text-[#00A19C]" /> Compartilhar</strong> na barra inferior do Safari.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00A19C]/10 font-bold text-[#00A19C]">
                  2
                </span>
                <span>
                  Role as opções e selecione <strong className="inline-flex items-center gap-1 text-slate-900 dark:text-white"><PlusSquare className="h-3.5 w-3.5 text-[#00A19C]" /> Adicionar à Tela de Início</strong>.
                </span>
              </li>
              <li className="flex items-start gap-2.5">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#00A19C]/10 font-bold text-[#00A19C]">
                  3
                </span>
                <span>
                  Confirme tocando em <strong className="text-slate-900 dark:text-white">Adicionar</strong> para usar em tela cheia e modo offline.
                </span>
              </li>
            </ol>

            <button
              type="button"
              onClick={() => pwaInstall.setIosGuideOpen(false)}
              className="w-full rounded-xl bg-[#00A19C] hover:bg-[#008C87] py-2.5 text-xs font-semibold text-white"
            >
              Entendi
            </button>
          </div>
        </div>
      )}

      {/* Toast Notificação */}
      {toastMessage && (
        <div className="fixed top-16 left-1/2 z-50 -translate-x-1/2 flex items-center gap-2 rounded-full bg-slate-900/95 dark:bg-slate-800 border border-slate-700 px-4 py-2 text-xs font-semibold text-white shadow-lg backdrop-blur max-w-[90vw] truncate">
          <CheckCircle2 className="h-3.5 w-3.5 text-[#00A19C] shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
