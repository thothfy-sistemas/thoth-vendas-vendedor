import React, { useState, useEffect, useMemo, useCallback } from 'react'
import {
  ClipboardList,
  Search,
  Calendar,
  User,
  Package,
  FileDown,
  Share2,
  X,
  Loader2,
  CheckCircle,
  Clock,
  AlertCircle,
  Bookmark,
  Send,
  Edit3,
  Trash2,
  RotateCcw,
  WifiOff,
  RefreshCw,
} from 'lucide-react'
import {
  getPedidos,
  getPedidoDetalhes,
  converterOrcamentoNoServidor,
  removerOrcamento,
  excluirPedidoNaoTransmitido,
  cancelarPedido,
  enviarPedido,
} from '../services/api'
import type { Pedido, OrcamentoSalvo, PendingOfflineOrder, ItemCarrinho } from '../types'
import {
  formatarWhatsApp,
  formatarWhatsAppPedidoServidor,
  abrirWhatsApp,
  gerarPdfPedido,
} from '../services/share'
import { AppLogo } from './AppLogo'

interface PedidosViewProps {
  empresaNome: string
  orcamentosLocais: OrcamentoSalvo[]
  pendingOfflineOrders: PendingOfflineOrder[]
  syncingOffline?: boolean
  isOffline?: boolean
  syncVersion?: number
  onSyncOffline: () => Promise<void>
  onRemoveOfflineOrder: (localId: string) => Promise<void>
  onRefreshOrcamentos: () => void
  onRestoreOrcamento: (orc: OrcamentoSalvo) => void
  initialFilter?: string
  onNotify?: (msg: string) => void
}

export function PedidosView({
  empresaNome,
  orcamentosLocais,
  pendingOfflineOrders,
  syncingOffline = false,
  isOffline = false,
  syncVersion = 0,
  onSyncOffline,
  onRemoveOfflineOrder,
  onRefreshOrcamentos,
  onRestoreOrcamento,
  initialFilter = 'todos',
  onNotify,
}: PedidosViewProps) {
  const [pedidos, setPedidos] = useState<Pedido[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<string>(initialFilter)
  const [search, setSearch] = useState('')
  const [selectedPedido, setSelectedPedido] = useState<Pedido | null>(null)
  const [loadingDetalhes, setLoadingDetalhes] = useState(false)
  const [convertingId, setConvertingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{
    type: 'convert_local' | 'convert_server' | 'delete_local' | 'delete_server' | 'cancel_server' | 'delete_offline'
    id: string
    label: string
    payload?: any
  } | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  useEffect(() => {
    setStatusFilter(initialFilter)
  }, [initialFilter])

  const carregarPedidos = useCallback(async (status?: string) => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const apiStatus = status === 'orcamentos' ? 'orcamento' : status
      const data = await getPedidos(apiStatus)
      setPedidos(data)
    } catch (err: any) {
      setErrorMsg(err?.message || 'Falha ao carregar pedidos.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarPedidos(statusFilter)
  }, [statusFilter, syncVersion, carregarPedidos])

  const handleOpenDetalhes = async (pedido: Pedido) => {
    setSelectedPedido(pedido)
    setLoadingDetalhes(true)
    try {
      const full = await getPedidoDetalhes(pedido.id)
      if (full) {
        setSelectedPedido(full)
      }
    } catch (err) {
      console.warn('Falha ao carregar itens do pedido:', err)
    } finally {
      setLoadingDetalhes(false)
    }
  }

  const executeConfirmAction = async () => {
    if (!confirmAction) return
    const action = confirmAction
    setConfirmAction(null)
    setErrorMsg(null)

    try {
      if (action.type === 'convert_local') {
        const orc: OrcamentoSalvo = action.payload
        setConvertingId(orc.id)
        if (orc.pedidoId) {
          await converterOrcamentoNoServidor(orc.pedidoId)
        } else {
          const descPct =
            orc.subtotal > 0
              ? Number(((orc.descontoTotal / orc.subtotal) * 100).toFixed(2))
              : 0
          const res = await enviarPedido(
            {
              clienteId: orc.cliente!.id,
              empresaId: orc.empresaId,
              tabelaPrecoId: orc.tabelaPrecoId,
              formaPagamentoId: orc.formaPagamentoId,
              prazoPagamentoId: orc.prazoPagamentoId,
              formaPagamento: orc.formaPagamento,
              condicaoPagamento: orc.condicaoPagamento,
              status: 'pendente',
              descontoValor: Number(orc.descontoTotal.toFixed(2)),
              descontoPercentual: descPct,
              observacoes: orc.observacoes?.trim() || undefined,
              itens: orc.itens.map((it) => ({
                produtoId: it.produtoId,
                quantidade: it.quantidade,
                precoUnitario: it.precoUnitarioCobrado,
                descontoPct: it.descontoPct || 0,
              })),
            },
            {
              empresaId: orc.empresaId,
              clienteNome: orc.cliente?.nome_fantasia || orc.cliente?.razao_social,
              totalEstimado: orc.valorTotal,
              descontoValor: Number(orc.descontoTotal.toFixed(2)),
              descontoPercentual: descPct,
              itensResumo: orc.itens.map((it) => ({
                nome: it.nome,
                codigo: it.codigo,
                unidade: it.unidade,
                quantidade: it.quantidade,
                precoUnitario: it.precoUnitarioCobrado,
                descontoPct: it.descontoPct || 0,
              })),
            }
          )
          await removerOrcamento(orc.id, orc.pedidoId)
          onRefreshOrcamentos()
          await carregarPedidos(statusFilter)
          onNotify?.(
            res?.offlineQueued
              ? 'Orçamento convertido e gravado na fila offline para envio ao reconectar!'
              : 'Orçamento convertido em Pedido e transmitido ao ERP!'
          )
          return
        }
        onRefreshOrcamentos()
        await carregarPedidos(statusFilter)
        onNotify?.('Orçamento convertido em Pedido e transmitido ao ERP!')
      } else if (action.type === 'convert_server') {
        const p: Pedido = action.payload
        setConvertingId(p.id)
        await converterOrcamentoNoServidor(p.id)
        onRefreshOrcamentos()
        await carregarPedidos(statusFilter)
        onNotify?.('Orçamento convertido em Pedido e transmitido ao ERP!')
      } else if (action.type === 'delete_local') {
        const orc: OrcamentoSalvo = action.payload
        setDeletingId(orc.id)
        await removerOrcamento(orc.id, orc.pedidoId)
        onRefreshOrcamentos()
        await carregarPedidos(statusFilter)
        onNotify?.(`Orçamento ${orc.numero} excluído.`)
      } else if (action.type === 'delete_server') {
        const p: Pedido = action.payload
        setDeletingId(p.id)
        await excluirPedidoNaoTransmitido(p.id)
        onRefreshOrcamentos()
        await carregarPedidos(statusFilter)
        onNotify?.(`Registro #${p.numero} removido.`)
      } else if (action.type === 'cancel_server') {
        const p: Pedido = action.payload
        setDeletingId(p.id)
        await cancelarPedido(p.id)
        await carregarPedidos(statusFilter)
        if (selectedPedido?.id === p.id) {
          setSelectedPedido((prev) => (prev ? { ...prev, status: 'cancelado' } : null))
        }
        onNotify?.(`Pedido #${p.numero} cancelado.`)
      } else if (action.type === 'delete_offline') {
        await onRemoveOfflineOrder(action.id)
        onNotify?.('Pedido offline removido da fila.')
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Não foi possível concluir a operação.')
    } finally {
      setConvertingId(null)
      setDeletingId(null)
    }
  }

  const handleConverterOrcamentoLocal = (orc: OrcamentoSalvo) => {
    if (!orc.cliente?.id) {
      onNotify?.('Selecione um cliente para transmitir este orçamento.')
      onRestoreOrcamento(orc)
      return
    }
    setConfirmAction({
      type: 'convert_local',
      id: orc.id,
      label: `Converter o orçamento ${orc.numero} em Pedido e transmitir ao ERP?`,
      payload: orc,
    })
  }

  const handleCompartilharWhatsApp = async (p: Pedido) => {
    let full = p
    if (!p.itens || p.itens.length === 0) {
      const fetched = await getPedidoDetalhes(p.id)
      if (fetched) full = fetched
    }
    const texto = formatarWhatsAppPedidoServidor(full, empresaNome)
    abrirWhatsApp(undefined, texto)
  }

  const handleGerarPDF = async (p: Pedido) => {
    let full = p
    if (!p.itens || p.itens.length === 0) {
      const fetched = await getPedidoDetalhes(p.id)
      if (fetched) full = fetched
    }
    const itensCart: ItemCarrinho[] = (full.itens || []).map((it) => ({
      produtoId: it.produto_id,
      codigo: it.codigo_produto || '',
      nome: it.nome_produto || '',
      unidade: it.unidade || 'UN',
      quantidade: it.quantidade,
      precoUnitarioTabela: it.preco_unitario_tabela,
      precoUnitarioCobrado: it.preco_unitario_cobrado,
      descontoPct: it.desconto_pct || 0,
      subtotal: it.valor_total,
    }))
    gerarPdfPedido(
      {
        id: full.cliente_id,
        razao_social: full.cliente_nome || 'Cliente',
        cpf_cnpj: '',
        limite_credito: 0,
        saldo_devedor: 0,
        bloqueado: false,
      },
      itensCart,
      full.condicao_pagamento || 'À Vista',
      full.valor_total,
      full.observacao,
      {
        numero: full.numero || full.id.slice(0, 8),
        empresaNome,
        isOrcamento: full.status === 'orcamento',
        dataEmissao: new Date(full.created_at).toLocaleDateString('pt-BR'),
      }
    )
  }

  const localServerIds = useMemo(
    () => new Set(orcamentosLocais.map((o) => o.pedidoId).filter(Boolean) as string[]),
    [orcamentosLocais]
  )

  const filteredOrcamentosLocais = useMemo(() => {
    if (!search.trim()) return orcamentosLocais
    const term = search.toLowerCase().trim()
    return orcamentosLocais.filter(
      (o) =>
        o.numero?.toLowerCase().includes(term) ||
        o.cliente?.razao_social?.toLowerCase().includes(term) ||
        o.cliente?.nome_fantasia?.toLowerCase().includes(term)
    )
  }, [orcamentosLocais, search])

  const filteredPedidos = useMemo(() => {
    return pedidos.filter((p) => {
      // Evita duplicidade quando o orçamento já aparece na lista de Orçamentos Salvos logo abaixo das abas
      if ((p.status === 'orcamento' || p.status === 'rascunho') && localServerIds.has(p.id)) {
        return false
      }
      if (!search.trim()) return true
      const term = search.toLowerCase().trim()
      return (
        p.numero?.toLowerCase().includes(term) ||
        p.id.toLowerCase().includes(term) ||
        p.cliente_nome?.toLowerCase().includes(term)
      )
    })
  }, [pedidos, search, localServerIds])

  const showOrcamentosSection =
    filteredOrcamentosLocais.length > 0 && (statusFilter === 'todos' || statusFilter === 'orcamentos')

  const totalOrcamentosCount = useMemo(() => {
    const serverOnlyCount = pedidos.filter(
      (p) => (p.status === 'orcamento' || p.status === 'rascunho') && !localServerIds.has(p.id)
    ).length
    return orcamentosLocais.length + serverOnlyCount
  }, [orcamentosLocais.length, pedidos, localServerIds])

  const getStatusBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'faturado':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20">
            <CheckCircle className="h-3 w-3" /> Faturado
          </span>
        )
      case 'aprovado':
      case 'enviado':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2.5 py-0.5 text-[11px] font-semibold text-[#0F766E] border border-teal-200 dark:bg-[#00A19C]/15 dark:text-teal-300 dark:border-[#00A19C]/30">
            <CheckCircle className="h-3 w-3" /> {status === 'enviado' ? 'Enviado ERP' : 'Aprovado'}
          </span>
        )
      case 'orcamento':
      case 'rascunho':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
            <Bookmark className="h-3 w-3" /> Orçamento Salvo
          </span>
        )
      case 'cancelado':
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2.5 py-0.5 text-[11px] font-semibold text-rose-700 border border-rose-200 dark:bg-rose-500/10 dark:text-rose-400 dark:border-rose-500/20">
            <AlertCircle className="h-3 w-3" /> Cancelado
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-semibold text-amber-700 border border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20">
            <Clock className="h-3 w-3" /> Pendente
          </span>
        )
    }
  }

  const fmtBRL = (val: number) =>
    Number(val || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  return (
    <div className="w-full">
      {/* Top Bar Mobile */}
      <header className="sticky top-0 z-20 bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-b border-slate-200/80 dark:border-slate-800 md:hidden">
        <div className="flex items-center justify-between gap-2 px-4 py-3">
          <AppLogo product="vendas" size="sm" showText={true} variant="light" />
          <span className="rounded-full bg-[#00A19C]/10 border border-[#00A19C]/20 px-2.5 py-1 text-[11px] font-semibold text-[#00A19C]">
            Pedidos & Orçamentos
          </span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl w-full px-3 py-4 sm:px-6 sm:py-6 space-y-5">
        {/* Título e Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h2 className="font-display text-lg sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight flex items-center gap-2">
              <ClipboardList className="h-5 w-5 sm:h-6 sm:w-6 text-[#00A19C] shrink-0" />
              <span>Pedidos & Orçamentos</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Gerencie orçamentos salvos, fila offline e acompanhe o faturamento no ERP
            </p>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pedido ou cliente..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-white placeholder:text-slate-400 focus:outline-[#00A19C]"
              />
            </div>
            <button
              type="button"
              onClick={() => carregarPedidos(statusFilter)}
              disabled={loading}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 text-slate-600 dark:text-slate-300 hover:border-[#00A19C]/50"
              title="Atualizar lista"
            >
              <RefreshCw className={`h-4 w-4 text-[#00A19C] ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="rounded-xl border border-rose-200 dark:border-rose-500/20 bg-rose-50 dark:bg-rose-500/10 p-3.5 text-xs text-rose-700 dark:text-rose-400 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-rose-500 hover:text-rose-700">
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* Fila Offline Pendente */}
        {pendingOfflineOrders.length > 0 && (
          <div className="rounded-2xl border border-teal-200 dark:border-[#00A19C]/30 bg-teal-50/70 dark:bg-[#00A19C]/10 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#00A19C] text-white">
                  <WifiOff className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                    Pedidos na Fila Offline ({pendingOfflineOrders.length})
                  </h3>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300">
                    Gravados no dispositivo e prontos para envio ao servidor
                  </p>
                </div>
              </div>

              <button
                type="button"
                disabled={syncingOffline || isOffline || !navigator.onLine}
                onClick={onSyncOffline}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#00A19C] hover:bg-[#008C87] px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${syncingOffline ? 'animate-spin' : ''}`} />
                <span>{syncingOffline ? 'Sincronizando…' : 'Sincronizar Agora'}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {pendingOfflineOrders.map((off) => (
                <div
                  key={off.localId}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                      {off.clienteNome}
                    </p>
                    <p className="text-[10px] font-mono tabular-nums text-slate-400">
                      {new Date(off.queuedAt).toLocaleString('pt-BR')} • {off.condicaoPagamento}
                    </p>
                    {off.lastError && (
                      <p className="text-[10px] text-rose-600 dark:text-rose-400 mt-0.5 truncate">
                        {off.lastError}
                      </p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex items-center gap-2">
                    <span className="font-mono tabular-nums text-xs font-bold text-[#00A19C]">
                      {fmtBRL(off.totalEstimado)}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setConfirmAction({
                          type: 'delete_offline',
                          id: off.localId,
                          label: `Remover o pedido offline de ${off.clienteNome} da fila?`,
                        })
                      }
                      className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                      title="Remover da fila offline"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filtros de Status */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar text-xs">
          {[
            { id: 'todos', label: 'Todos' },
            { id: 'orcamentos', label: `Orçamentos (${totalOrcamentosCount})` },
            { id: 'pendente', label: 'Pendentes' },
            { id: 'aprovado', label: 'Aprovados' },
            { id: 'faturado', label: 'Faturados' },
            { id: 'cancelado', label: 'Cancelados' },
          ].map((tab) => (
            <button
              type="button"
              key={tab.id}
              onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all border ${
                statusFilter === tab.id
                  ? 'bg-[#00A19C] text-white border-[#00A19C] shadow-2xs'
                  : 'bg-white dark:bg-slate-900 border-slate-200/80 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:border-[#00A19C]/40'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Seção: Orçamentos Salvos */}
        {showOrcamentosSection && (
          <div className="rounded-2xl border border-amber-200 dark:border-amber-500/30 bg-amber-50/60 dark:bg-amber-500/5 p-4 sm:p-5 space-y-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-300/60 dark:border-amber-500/30">
                <Bookmark className="h-4 w-4" />
              </div>
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
                  Orçamentos Salvos ({filteredOrcamentosLocais.length})
                </h3>
                <p className="text-[11px] text-slate-600 dark:text-slate-400">
                  Reabra no carrinho para editar descontos/itens ou transmita direto como pedido
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredOrcamentosLocais.map((orc) => (
                <div
                  key={orc.id}
                  className="rounded-xl border border-amber-200/80 dark:border-amber-500/20 bg-white dark:bg-slate-900 p-3.5 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-mono tabular-nums font-bold text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/15 border border-amber-200 dark:border-amber-500/20 px-2 py-0.5 rounded-md">
                          {orc.numero}
                        </span>
                        <span className="text-[11px] font-mono tabular-nums text-slate-400">
                          {new Date(orc.createdAt).toLocaleDateString('pt-BR', {
                            day: '2-digit',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="mt-1.5 text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {orc.cliente?.razao_social || 'Cliente ainda não selecionado'}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 font-mono tabular-nums">
                        {orc.itens.length} produto(s) • {orc.condicaoPagamento}
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Valor Líquido</div>
                      <div className="font-mono tabular-nums text-base font-bold text-[#00A19C]">
                        {fmtBRL(orc.valorTotal)}
                      </div>
                      {orc.descontoTotal > 0 && (
                        <div className="font-mono tabular-nums text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                          Desc: -{fmtBRL(orc.descontoTotal)}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-1.5 pt-2.5 border-t border-slate-100 dark:border-slate-800">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          const txt = formatarWhatsApp(
                            orc.cliente,
                            orc.itens,
                            orc.condicaoPagamento,
                            orc.valorTotal,
                            orc.observacoes,
                            { numero: orc.numero, empresaNome, isOrcamento: true }
                          )
                          abrirWhatsApp(orc.cliente?.telefone || orc.cliente?.celular, txt)
                        }}
                        className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 text-xs"
                        title="Enviar Orçamento por WhatsApp"
                      >
                        <Share2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          gerarPdfPedido(
                            orc.cliente,
                            orc.itens,
                            orc.condicaoPagamento,
                            orc.valorTotal,
                            orc.observacoes,
                            {
                              numero: orc.numero,
                              empresaNome,
                              isOrcamento: true,
                              dataEmissao: new Date(orc.createdAt).toLocaleDateString('pt-BR'),
                            }
                          )
                        }
                        className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-[#00A19C] hover:bg-teal-50 dark:hover:bg-[#00A19C]/10 text-xs"
                        title="Baixar PDF do Orçamento"
                      >
                        <FileDown className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === orc.id}
                        onClick={() =>
                          setConfirmAction({
                            type: 'delete_local',
                            id: orc.id,
                            label: `Excluir o orçamento salvo ${orc.numero}?`,
                            payload: orc,
                          })
                        }
                        className="p-1.5 rounded-lg border border-slate-200/80 dark:border-slate-700 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 text-xs disabled:opacity-50"
                        title="Excluir Orçamento"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => onRestoreOrcamento(orc)}
                        className="flex items-center gap-1 rounded-xl border border-[#00A19C]/40 bg-[#00A19C]/10 px-2.5 py-1.5 text-xs font-semibold text-[#0F766E] dark:text-teal-300 hover:bg-[#00A19C]/20 transition-colors"
                      >
                        <Edit3 className="h-3.5 w-3.5" />
                        <span>Abrir no Carrinho</span>
                      </button>
                      <button
                        type="button"
                        disabled={convertingId === orc.id}
                        onClick={() => handleConverterOrcamentoLocal(orc)}
                        className="flex items-center gap-1 rounded-xl bg-[#00A19C] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#008C87] shadow-2xs disabled:opacity-50"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>{convertingId === orc.id ? 'Enviando...' : 'Virar Pedido'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Lista de Pedidos do Servidor */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-8 w-8 animate-spin text-[#00A19C] mb-2" />
            <p className="text-xs">Carregando histórico de pedidos…</p>
          </div>
        ) : filteredPedidos.length === 0 && !showOrcamentosSection ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 text-center px-4">
            <ClipboardList className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-2" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">
              Nenhum registro encontrado neste filtro
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {search ? 'Tente buscar por outro termo' : 'Os pedidos sincronizados aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredPedidos.map((pedido) => {
              const valorTotalFmt = fmtBRL(pedido.valor_total)
              const dataFmt = new Date(pedido.created_at).toLocaleDateString('pt-BR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
              const podeExcluir =
                !pedido.erp_id &&
                !pedido.erp_pedido_id &&
                (pedido.status === 'orcamento' || pedido.status === 'rascunho' || pedido.status === 'pendente')
              const podeCancelar =
                pedido.status !== 'faturado' &&
                pedido.status !== 'cancelado' &&
                pedido.status !== 'orcamento' &&
                pedido.status !== 'rascunho'

              return (
                <div
                  key={pedido.id}
                  className="rounded-xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-3.5 sm:p-4 shadow-xs hover:border-[#00A19C]/50 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-mono tabular-nums font-bold text-slate-900 dark:text-white">
                          #{pedido.numero || pedido.id.slice(0, 8)}
                        </span>
                        {getStatusBadge(pedido.status)}
                        {pedido.erp_sync_status === 'erro' && (
                          <span
                            title={pedido.erp_sync_error || 'Falha ao sincronizar com ERP'}
                            className="inline-flex items-center gap-1 rounded-full bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400"
                          >
                            <AlertCircle className="h-2.5 w-2.5" /> Erro ERP
                          </span>
                        )}
                      </div>
                      <div className="mt-1.5 flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-100">
                        <User className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{pedido.cliente_nome || 'Cliente não identificado'}</span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1.5 text-[11px] font-mono tabular-nums text-slate-400 flex-wrap">
                        <Calendar className="h-3 w-3 shrink-0" />
                        <span>{dataFmt}</span>
                        {pedido.desconto_total > 0 && (
                          <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                            • Desc: -{fmtBRL(pedido.desconto_total)}
                          </span>
                        )}
                        {pedido.comissao_valor && pedido.comissao_valor > 0 ? (
                          <span className="text-[#00A19C] font-semibold">
                            • Com: {fmtBRL(pedido.comissao_valor)}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <div className="text-right shrink-0">
                      <div className="text-[10px] text-slate-400">Total</div>
                      <div className="font-mono tabular-nums text-base sm:text-lg font-bold text-[#00A19C]">
                        {valorTotalFmt}
                      </div>
                    </div>
                  </div>

                  {/* Ações do Card */}
                  <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-end gap-1.5 sm:gap-2">
                    {podeExcluir && (
                      <button
                        type="button"
                        disabled={deletingId === pedido.id}
                        onClick={() =>
                          setConfirmAction({
                            type: 'delete_server',
                            id: pedido.id,
                            label: `Excluir #${pedido.numero || pedido.id.slice(0, 8)} antes de sincronizar com o ERP?`,
                            payload: pedido,
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Excluir</span>
                      </button>
                    )}

                    {podeCancelar && !podeExcluir && (
                      <button
                        type="button"
                        disabled={deletingId === pedido.id}
                        onClick={() =>
                          setConfirmAction({
                            type: 'cancel_server',
                            id: pedido.id,
                            label: `Cancelar o pedido #${pedido.numero || pedido.id.slice(0, 8)}?`,
                            payload: pedido,
                          })
                        }
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-colors disabled:opacity-50"
                      >
                        <X className="h-3.5 w-3.5" />
                        <span className="hidden sm:inline">Cancelar</span>
                      </button>
                    )}

                    {pedido.status === 'orcamento' && (
                      <button
                        type="button"
                        disabled={convertingId === pedido.id}
                        onClick={() =>
                          setConfirmAction({
                            type: 'convert_server',
                            id: pedido.id,
                            label: `Converter o orçamento #${pedido.numero} em Pedido e transmitir ao ERP?`,
                            payload: pedido,
                          })
                        }
                        className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-xs font-semibold text-slate-950 transition-colors"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Converter em Pedido</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => handleCompartilharWhatsApp(pedido)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <Share2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                      <span>WhatsApp</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleGerarPDF(pedido)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
                    >
                      <FileDown className="h-3.5 w-3.5 text-[#00A19C]" />
                      <span>PDF</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenDetalhes(pedido)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#00A19C] hover:bg-[#008C87] text-xs font-semibold text-white transition-colors shadow-2xs"
                    >
                      <Package className="h-3.5 w-3.5" />
                      <span>Detalhes</span>
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Modal de Detalhes do Pedido */}
      {selectedPedido && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4">
          <div className="w-full max-w-xl max-h-[88dvh] flex flex-col rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 px-4 py-3.5 sm:px-5 sm:py-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-mono tabular-nums text-sm sm:text-base font-bold text-slate-900 dark:text-white">
                    #{selectedPedido.numero || selectedPedido.id.slice(0, 8)}
                  </h3>
                  {getStatusBadge(selectedPedido.status)}
                </div>
                <p className="text-[11px] font-mono tabular-nums text-slate-400 mt-0.5">
                  {new Date(selectedPedido.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPedido(null)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-slate-800/50 border border-slate-200/80 dark:border-slate-800 p-3">
                <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
                  Cliente
                </span>
                <p className="text-xs sm:text-sm font-semibold text-slate-900 dark:text-white">
                  {selectedPedido.cliente_nome || 'Cliente'}
                </p>
                {selectedPedido.condicao_pagamento && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                    Condição: {selectedPedido.condicao_pagamento}
                  </p>
                )}
                {selectedPedido.observacao && (
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 italic">
                    Obs: {selectedPedido.observacao}
                  </p>
                )}
              </div>

              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Itens do Pedido
                </span>
                {loadingDetalhes ? (
                  <div className="py-6 text-center text-xs text-slate-400">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto text-[#00A19C] mb-1" />
                    Carregando itens…
                  </div>
                ) : selectedPedido.itens && selectedPedido.itens.length > 0 ? (
                  <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-800 border border-slate-200/80 dark:border-slate-800 rounded-xl overflow-hidden">
                    {selectedPedido.itens.map((it) => (
                      <div
                        key={it.id || it.produto_id}
                        className="p-3 flex items-center justify-between gap-2 text-xs"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-slate-900 dark:text-white truncate">
                            {it.nome_produto}
                          </p>
                          <p className="text-slate-400 text-[10px] font-mono tabular-nums">
                            #{it.codigo_produto || '-'} • {it.quantidade} {it.unidade || 'UN'} x{' '}
                            {fmtBRL(it.preco_unitario_cobrado)}
                            {it.desconto_pct > 0 && (
                              <span className="text-[#00A19C] ml-1">(-{it.desconto_pct.toFixed(1)}%)</span>
                            )}
                          </p>
                        </div>
                        <span className="font-mono tabular-nums font-bold text-slate-900 dark:text-white shrink-0">
                          {fmtBRL(it.valor_total)}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 py-3 italic">Itens consolidados no ERP.</p>
                )}
              </div>

              <div className="rounded-xl bg-teal-50/70 dark:bg-[#00A19C]/10 border border-teal-200/80 dark:border-[#00A19C]/20 p-3.5 space-y-1 text-xs">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Subtotal</span>
                  <span className="font-mono tabular-nums">{fmtBRL(selectedPedido.subtotal)}</span>
                </div>
                {selectedPedido.desconto_total > 0 && (
                  <div className="flex justify-between text-[#00A19C] font-semibold">
                    <span>Desconto Total</span>
                    <span className="font-mono tabular-nums">- {fmtBRL(selectedPedido.desconto_total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-slate-900 dark:text-white pt-1.5 border-t border-teal-200/70 dark:border-[#00A19C]/20">
                  <span>Valor Total</span>
                  <span className="font-mono tabular-nums text-[#00A19C]">
                    {fmtBRL(selectedPedido.valor_total)}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4">
              {selectedPedido.itens && selectedPedido.itens.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    onRestoreOrcamento({
                      id: `rep_${Date.now()}`,
                      numero: `REP-${selectedPedido.numero}`,
                      tabelaPrecoId: selectedPedido.tabela_preco_id,
                      formaPagamento: selectedPedido.forma_pagamento,
                      cliente: {
                        id: selectedPedido.cliente_id,
                        razao_social: selectedPedido.cliente_nome || 'Cliente',
                        cpf_cnpj: '',
                        limite_credito: 0,
                        saldo_devedor: 0,
                        bloqueado: false,
                      },
                      condicaoPagamento: selectedPedido.condicao_pagamento || 'À Vista',
                      observacoes: selectedPedido.observacao || '',
                      itens: (selectedPedido.itens || []).map((i) => ({
                        produtoId: i.produto_id,
                        codigo: i.codigo_produto || '',
                        nome: i.nome_produto || '',
                        unidade: i.unidade || 'UN',
                        quantidade: i.quantidade,
                        precoUnitarioTabela: i.preco_unitario_tabela,
                        precoUnitarioCobrado: i.preco_unitario_tabela,
                        tabelaPrecoId: selectedPedido.tabela_preco_id,
                        descontoPct: i.desconto_pct || 0,
                        subtotal: i.valor_total,
                      })),
                      subtotal: selectedPedido.subtotal,
                      descontoTotal: selectedPedido.desconto_total,
                      valorTotal: selectedPedido.valor_total,
                      createdAt: new Date().toISOString(),
                      updatedAt: new Date().toISOString(),
                    })
                    setSelectedPedido(null)
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#00A19C] text-xs font-semibold text-[#00A19C] hover:bg-[#00A19C]/10"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Repetir no Carrinho</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => handleCompartilharWhatsApp(selectedPedido)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <Share2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>WhatsApp</span>
              </button>
              <button
                type="button"
                onClick={() => handleGerarPDF(selectedPedido)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#00A19C] text-white text-xs font-semibold hover:bg-[#008C87] shadow-xs"
              >
                <FileDown className="h-3.5 w-3.5" />
                <span>Baixar PDF</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação Inline */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-sm rounded-2xl border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 p-5 shadow-2xl space-y-4">
            <h3 className="font-display text-sm font-bold text-slate-900 dark:text-white">
              Confirmar Ação
            </h3>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {confirmAction.label}
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmAction(null)}
                className="rounded-xl border border-slate-200/80 dark:border-slate-700 px-3.5 py-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={executeConfirmAction}
                className={`rounded-xl px-4 py-2 text-xs font-semibold text-white ${
                  confirmAction.type.startsWith('delete') || confirmAction.type === 'cancel_server'
                    ? 'bg-rose-600 hover:bg-rose-700'
                    : 'bg-[#00A19C] hover:bg-[#008C87]'
                }`}
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
