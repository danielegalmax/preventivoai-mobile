import { BuilderMemoryState } from './types'
import { meseCorrenteString } from 'previcloud-shared'

/** Cliente in memoria condivisa builder ↔ preventivo-pdf (campi minimi + optional del tipo Cliente). */
export type BuilderClienteMemoria = {
  id: string
  nome: string
  telefono: string | null
  email: string | null
  indirizzo: string | null
} | null

export type BuilderState = BuilderMemoryState & {
  cliente: BuilderClienteMemoria
}

export const builderState: BuilderState = {
  voci: [],
  nomeCliente: '',
  noteExtra: '',
  includiIva: false,
  trasferte: [],
  mostraTrasferte: false,
  nuovaSpesaNome: '',
  nuovaSpesaImporto: '',
  nuoviKm: '',
  abbonamentoAttivo: false,
  abImporto: '',
  abGiorno: '1',
  abMeseInizio: meseCorrenteString(),
  abMensilita: '',
  abVisibileNelPDF: true,
  pagamentoRateAttivo: false,
  rateNumero: '',
  rateGiornoScadenza: '1',
  rateMeseInizio: meseCorrenteString(),
  rateVisibileNelPDF: true,
  metodoPagamentoNessuno: false,
  metodoPagamentoId: null,
  nascondiPrezzi: false,
  scontoAttivo: false,
  scontoTipo: 'percentuale',
  scontoValore: '',
  cliente: null,
}

export function resetBuilderState() {
  builderState.voci = []
  builderState.nomeCliente = ''
  builderState.noteExtra = ''
  builderState.includiIva = false
  builderState.trasferte = []
  builderState.mostraTrasferte = false
  builderState.nuovaSpesaNome = ''
  builderState.nuovaSpesaImporto = ''
  builderState.nuoviKm = ''
  builderState.abbonamentoAttivo = false
  builderState.abImporto = ''
  builderState.abGiorno = '1'
  builderState.abMeseInizio = meseCorrenteString()
  builderState.abMensilita = ''
  builderState.abVisibileNelPDF = true
  builderState.pagamentoRateAttivo = false
  builderState.rateNumero = ''
  builderState.rateGiornoScadenza = '1'
  builderState.rateMeseInizio = meseCorrenteString()
  builderState.rateVisibileNelPDF = true
  builderState.metodoPagamentoNessuno = false
  builderState.metodoPagamentoId = null
  builderState.nascondiPrezzi = false
  builderState.scontoAttivo = false
  builderState.scontoTipo = 'percentuale'
  builderState.scontoValore = ''
  builderState.cliente = null
}
