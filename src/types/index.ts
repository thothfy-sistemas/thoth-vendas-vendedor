export interface Produto {
  id: string
  codigo: string
  nome: string
  descricao?: string
  categoria_id?: string
  categoria_nome?: string
  unidade: string
  preco_tabela: number
  preco_custo?: number
  preco_minimo?: number
  estoque_atual: number
  estoque_reservado?: number
  estoque_minimo?: number
  ncm?: string
  codigo_barras?: string
  imagem_url?: string
  ativo: boolean
}

export interface Categoria {
  id: string
  nome: string
  icone?: string
  ativa: boolean
}

export interface TabelaPreco {
  id: string
  nome: string
  descricao?: string
  tipo_ajuste: string
  percentual_ajuste: number
  padrao: boolean
}

export interface Cliente {
  id: string
  razao_social: string
  nome_fantasia?: string
  cpf_cnpj: string
  inscricao_estadual?: string
  email?: string
  telefone?: string
  celular?: string
  contato_nome?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  tabela_preco_id?: string
  vendedor_id?: string
  limite_credito: number
  saldo_devedor: number
  bloqueado: boolean
  motivo_bloqueio?: string
  observacoes?: string
  ultimo_pedido_em?: string
  ultimo_pedido_valor?: number
  total_pedidos?: number
}

export interface ItemCarrinho {
  produtoId: string
  codigo: string
  nome: string
  unidade: string
  quantidade: number
  precoUnitarioTabela: number
  precoUnitarioCobrado: number
  tabelaPrecoId?: string
  descontoPct: number
  descontoValor?: number
  subtotal: number
  imagemUrl?: string
}

export interface OrcamentoSalvo {
  id: string
  numero: string
  pedidoId?: string
  pendingLocalId?: string
  empresaId?: string
  vendedorId?: string
  cliente: Cliente | null
  tabelaPrecoId?: string
  formaPagamentoId?: string
  prazoPagamentoId?: string
  formaPagamento?: string
  condicaoPagamento: string
  observacoes: string
  itens: ItemCarrinho[]
  subtotal: number
  descontoTotal: number
  valorTotal: number
  createdAt: string
  updatedAt: string
}

export interface CondicaoPagamentoOption {
  codigo: string
  nome: string
}

export interface FormaPagamento {
  id: string
  empresa_id: string
  nome: string
  tipo: string
  ativa: boolean
}

export interface PrazoPagamento {
  id: string
  empresa_id: string
  nome: string
  dias: number
  parcelas: number
  ativo: boolean
}

export interface EmpresaVinculo {
  id?: string
  empresa_id?: string
  slug: string
  razao_social: string
  nome_fantasia?: string
  cnpj?: string
  logo_url?: string
  role?: string
  ativa: boolean
  moeda?: string
  desconto_maximo_vendedor_pct?: number
  valor_pedido_minimo?: number
  bloquear_venda_sem_estoque?: boolean
  permitir_pedido_offline?: boolean
}

export interface UsuarioVendedor {
  id: string
  nome: string
  email: string
  cpf?: string
  telefone?: string
  meta_mensal?: number
  comissao_pct?: number
  limite_desconto_pct?: number
}

export interface ItemPedido {
  id: string
  pedido_id: string
  produto_id: string
  codigo_produto: string
  nome_produto: string
  unidade: string
  quantidade: number
  preco_unitario_tabela: number
  preco_unitario_cobrado: number
  desconto_pct: number
  subtotal: number
  valor_total: number
}

export interface Pedido {
  id: string
  empresa_id: string
  numero: string
  cliente_id: string
  cliente_nome?: string
  vendedor_id?: string
  vendedor_nome?: string
  tabela_preco_id?: string
  forma_pagamento_id?: string
  prazo_pagamento_id?: string
  status: 'orcamento' | 'pendente' | 'enviado' | 'aprovado' | 'faturado' | 'cancelado' | string
  condicao_pagamento?: string
  forma_pagamento?: string
  subtotal: number
  desconto_total: number
  valor_total: number
  observacao?: string
  origem: string
  erp_id?: string
  erp_pedido_id?: string
  erp_sync_status?: string
  erp_sync_error?: string
  comissao_valor?: number
  last_erp_sync_at?: string
  data_faturamento?: string
  created_at: string
  updated_at: string
  itens?: ItemPedido[]
}

export interface CriarPedidoPayload {
  clienteId: string
  empresaId?: string
  tabelaPrecoId?: string
  formaPagamentoId?: string
  prazoPagamentoId?: string
  condicaoPagamento?: string
  formaPagamento?: string
  status?: 'pendente' | 'orcamento'
  descontoGeralValor?: number
  descontoValor?: number
  descontoPercentual?: number
  observacoes?: string
  itens: {
    produtoId: string
    quantidade: number
    precoUnitario: number
    descontoPct: number
    descontoValor?: number
  }[]
}

export interface PendingOfflineOrder {
  localId: string
  empresaId?: string
  clienteNome: string
  condicaoPagamento: string
  formaPagamento?: string
  descontoValor?: number
  descontoPercentual?: number
  totalEstimado: number
  itensResumo: { nome: string; codigo: string; unidade: string; quantidade: number; precoUnitario: number; descontoPct: number }[]
  queuedAt: string
  lastError?: string
  payload: CriarPedidoPayload
}

export interface VendasDiaPonto {
  data: string
  total_valor: number
  qtd_pedidos: number
}

export interface VendedorMeta {
  vendedor_id: string
  vendedor_nome: string
  meta_mensal: number
  total_vendido: number
  percentual_atingido: number
  falta_para_meta: number
  comissao_pct: number
  comissao_estimada: number
  total_pedidos: number
  total_clientes_atendidos: number
  ticket_medio: number
  vendas_por_dia: VendasDiaPonto[]
}

export interface NovoClientePayload {
  razao_social: string
  nome_fantasia?: string
  cpf_cnpj: string
  inscricao_estadual?: string
  email?: string
  telefone?: string
  celular?: string
  contato_nome?: string
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  estado?: string
  tabela_preco_id?: string
  observacoes?: string
}
