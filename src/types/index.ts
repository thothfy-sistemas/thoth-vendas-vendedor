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
  email?: string
  telefone?: string
  celular?: string
  contato_nome?: string
  cidade?: string
  estado?: string
  tabela_preco_id?: string
  limite_credito: number
  saldo_devedor: number
  bloqueado: boolean
  motivo_bloqueio?: string
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
  subtotal: number
  imagemUrl?: string
}

export interface CondicaoPagamentoOption {
  codigo: string
  nome: string
}
