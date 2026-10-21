import React, { useState, useEffect, useMemo } from 'react'
import { Header } from './components/Header'
import { ProductCard } from './components/ProductCard'
import { CartDrawer } from './components/CartDrawer'
import { ClientSelectModal } from './components/ClientSelectModal'
import { getProdutos, getCategorias, getTabelasPreco, getClientes, enviarPedido, getMe } from './services/api'
import type { Produto, Categoria, TabelaPreco, Cliente, ItemCarrinho } from './types'
import { ChevronRight, PackageSearch, Loader2, CheckCircle2 } from 'lucide-react'

export function App() {
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [tabelas, setTabelas] = useState<TabelaPreco[]>([])
  const [clientes, setClientes] = useState<Cliente[]>([])
  const [loading, setLoading] = useState(true)
  const [fromCache, setFromCache] = useState(false)
  const [isOffline, setIsOffline] = useState(!navigator.onLine)

  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)

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
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [empresaNome, setEmpresaNome] = useState('Thoth Vendas')

  // Salva carrinho localmente
  useEffect(() => {
    localStorage.setItem('vendedor_carrinho', JSON.stringify(itens))
  }, [itens])

  useEffect(() => {
    if (selectedCliente) {
      localStorage.setItem('vendedor_cliente', JSON.stringify(selectedCliente))
    } else {
      localStorage.removeItem('vendedor_cliente')
    }
  }, [selectedCliente])

  // Escuta status offline/online
  useEffect(() => {
    const handleOnline = () => setIsOffline(false)
    const handleOffline = () => setIsOffline(true)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // Carga inicial dos dados
  useEffect(() => {
    async function carregarDados() {
      setLoading(true)
      try {
        const [prodData, cats, tabs, clis, me] = await Promise.all([
          getProdutos(),
          getCategorias(),
          getTabelasPreco(),
          getClientes(),
          getMe(),
        ])
        setProdutos(prodData.produtos)
        setFromCache(prodData.fromCache)
        setCategorias(cats)
        setTabelas(tabs)
        setClientes(clis)
        if (me?.empresaAtiva?.razao_social || me?.empresaAtiva?.nome_fantasia) {
          setEmpresaNome(me.empresaAtiva.nome_fantasia || me.empresaAtiva.razao_social)
        }
      } catch (err) {
        console.error('Falha ao carregar dados:', err)
      } finally {
        setLoading(false)
      }
    }
    carregarDados()
  }, [])

  const showToast = (msg: string) => {
    setToastMessage(msg)
    setTimeout(() => setToastMessage(null), 3000)
  }

  // Adicionar ao carrinho
  const handleAddToCart = (produto: Produto, quantidade: number, tabelaId?: string) => {
    const tabela = tabelas.find((t) => t.id === tabelaId)
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
      const idx = prev.findIndex((it) => it.produtoId === produto.id && it.tabelaPrecoId === tabelaId)
      if (idx >= 0) {
        const copy = [...prev]
        const newQty = copy[idx].quantidade + quantidade
        copy[idx] = {
          ...copy[idx],
          quantidade: newQty,
          subtotal: newQty * precoCobrado,
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
          tabelaPrecoId: tabelaId,
          descontoPct: 0,
          subtotal: quantidade * precoCobrado,
          imagemUrl: produto.imagem_url,
        },
      ]
    })
    showToast(`+${quantidade} ${produto.nome.slice(0, 24)} adicionado`)
  }

  const handleUpdateQty = (produtoId: string, quantidade: number) => {
    setItens((prev) =>
      prev.map((it) => {
        if (it.produtoId === produtoId) {
          return {
            ...it,
            quantidade,
            subtotal: quantidade * it.precoUnitarioCobrado,
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
    if (confirm('Deseja realmente limpar todos os itens do pedido?')) {
      setItens([])
    }
  }

  // Transmitir pedido para a API
  const handleSubmitOrder = async (observacoes: string, condicao: string) => {
    if (!selectedCliente) return
    setIsSubmitting(true)
    try {
      const payload = {
        clienteId: selectedCliente.id,
        tabelaPrecoId: itens[0]?.tabelaPrecoId,
        observacoes: `[Condição: ${condicao}] ${observacoes}`.trim(),
        itens: itens.map((it) => ({
          produtoId: it.produtoId,
          quantidade: it.quantidade,
          precoUnitario: it.precoUnitarioCobrado,
          descontoPct: it.descontoPct,
        })),
      }
      const res = await enviarPedido(payload)
      if (res.offlineQueued) {
        alert('Você está offline. O pedido foi gravado localmente e será enviado assim que a internet retornar!')
      } else {
        alert('✅ Pedido emitido e transmitido com sucesso!')
      }
      setItens([])
      setCartOpen(false)
    } catch (err: any) {
      alert(`Falha ao emitir pedido: ${err.message || err}`)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Filtros
  const filteredProducts = useMemo(() => {
    return produtos.filter((p) => {
      if (selectedCategory && p.categoria_id !== selectedCategory) return false
      if (!search.trim()) return true
      const term = search.toLowerCase().trim()
      return (
        p.nome.toLowerCase().includes(term) ||
        p.codigo.toLowerCase().includes(term) ||
        (p.categoria_nome && p.categoria_nome.toLowerCase().includes(term))
      )
    })
  }, [produtos, selectedCategory, search])

  const cartTotal = itens.reduce((acc, it) => acc + it.subtotal, 0)
  const cartCount = itens.reduce((acc, it) => acc + it.quantidade, 0)
  const cartTotalFmt = cartTotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="min-h-screen bg-slate-50 pb-28 md:pb-10">
      {/* Topo no estilo Lavizoo */}
      <Header
        storeName={empresaNome}
        search={search}
        setSearch={setSearch}
        categories={categorias}
        selectedCategory={selectedCategory}
        setSelectedCategory={setSelectedCategory}
        cartCount={cartCount}
        cartTotal={cartTotal}
        onOpenCart={() => setCartOpen(true)}
        isOffline={isOffline}
      />

      {/* Conteúdo do Catálogo */}
      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6">
        <div className="mb-3 flex items-center justify-between text-xs text-slate-500 sm:text-sm px-1">
          <span>
            {filteredProducts.length} produto(s) disponível(is)
            {fromCache ? ' • dados salvos offline' : ''}
          </span>
          {selectedCliente && (
            <span className="font-bold text-teal-800 truncate max-w-[200px]">
              👤 {selectedCliente.razao_social}
            </span>
          )}
        </div>

        {loading ? (
          <div className="flex h-64 flex-col items-center justify-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-teal-700" />
            <p className="text-xs font-bold text-slate-500">Carregando catálogo de produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-sm">
            <PackageSearch className="mx-auto h-12 w-12 text-slate-300" />
            <h3 className="mt-3 text-sm font-bold text-slate-900">Nenhum produto encontrado</h3>
            <p className="mt-1 text-xs text-slate-500">Tente buscar por outro termo ou categoria.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
            {filteredProducts.map((p) => (
              <ProductCard
                key={p.id}
                produto={p}
                tabelas={tabelas}
                tabelaAtivaId={tabelas[0]?.id}
                onAddToCart={handleAddToCart}
              />
            ))}
          </div>
        )}
      </main>

      {/* Barra Fixa Flutuante no Mobile (Estilo Lavizoo) */}
      {cartCount > 0 && !cartOpen && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-teal-900 bg-[#0F3C46]/95 px-4 pb-[max(0.85rem,env(safe-area-inset-bottom))] pt-2.5 text-white backdrop-blur shadow-2xl md:hidden">
          <button
            onClick={() => setCartOpen(true)}
            className="flex w-full items-center justify-between gap-3 active:scale-[0.99] transition-transform"
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-400 font-black text-slate-900 shadow">
                {cartCount}
              </span>
              <div className="text-left">
                <span className="block text-[10px] text-teal-200">Total do Pedido</span>
                <span className="block text-sm font-black leading-tight">{cartTotalFmt}</span>
              </div>
            </div>

            <div className="flex items-center gap-1 rounded-xl bg-teal-500 px-4 py-2.5 text-xs font-bold shadow">
              <span>Ver Pedido</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </button>
        </div>
      )}

      {/* Drawer do Carrinho */}
      <CartDrawer
        isOpen={cartOpen}
        onClose={() => setCartOpen(false)}
        itens={itens}
        onUpdateQty={handleUpdateQty}
        onRemoveItem={handleRemoveItem}
        onClearCart={handleClearCart}
        selectedCliente={selectedCliente}
        onOpenClienteSelect={() => setClienteModalOpen(true)}
        onSubmitOrder={handleSubmitOrder}
        isSubmitting={isSubmitting}
      />

      {/* Modal de Seleção de Cliente */}
      <ClientSelectModal
        isOpen={clienteModalOpen}
        onClose={() => setClienteModalOpen(false)}
        clientes={clientes}
        selectedCliente={selectedCliente}
        onSelect={(c) => setSelectedCliente(c)}
      />

      {/* Toast Flutuante de Confirmação */}
      {toastMessage && (
        <div className="fixed inset-x-0 bottom-20 z-50 mx-auto flex w-fit max-w-[90%] items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-xs font-bold text-white shadow-xl animate-bounce">
          <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          <span className="truncate">{toastMessage}</span>
        </div>
      )}
    </div>
  )
}
