import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TouchableOpacity, View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { currentUserId } from '../../lib/api/auth';
import { creaServizioListino } from '../../lib/api/servizi';
import { Cliente, ProfiloFiscale, Servizio, VocePreventivo } from '../../lib/types';
import { eventBus } from '../../lib/eventBus';
import { trackEvento } from '../../lib/api/track';
import { formatImportoEuroVisuale, calcolaTotaleVoci, calcolaTotaleTrasferte, parseImportoEuro } from 'previcloud-shared';
import { builderState, resetBuilderState } from '../../lib/builder/state';
import {
  applicaBozzaABuilderState,
  bozzaBuilderVuota,
  bozzaBuilderVuotaDaState,
  buildBuilderDraft,
  cancellaBozzaBuilder,
  caricaBozzaBuilder,
  clienteIdUtilizzabile,
  messaggioRipresaBozza,
  salvaBozzaBuilder,
  type BuilderDraft,
} from '../../lib/builder/draft';
import { caricaClientiBuilder, caricaMetodiPagamentoBuilder, caricaProfiloFiscaleBuilder, caricaServiziBuilder, creaClienteBuilder, metodoContantiDefault } from '../../lib/builder/data';
import { calcolaFiscalePreventivo, calcolaLordoDaNetto as calcolaLordoDaNettoBuilder } from '../../lib/builder/fiscale';
import { parsePreventivoTesto, collegaVociAlListino, trovaMetodoPagamentoDaNome, vociParsedConServizioId } from '../../lib/builder/parsePreventivoText';
import { risolviModifica } from '../../lib/features/modificaPreventivo/modificaSession';
import { generaTestoPreventivoBuilder } from '../../lib/builder/preventivoText';
import { TrasfertaBuilder } from '../../lib/builder/types';
import { VoceCustomModal } from '../../lib/components/builder/VoceCustomModal';
import { TrasferteCard } from '../../lib/components/builder/TrasferteCard';
import { ScontoCard } from '../../lib/components/builder/ScontoCard';
import { ServiziListinoCard } from '../../lib/components/builder/ServiziListinoCard';
import { ClienteCard } from '../../lib/components/builder/ClienteCard';
import { NoteAggiuntiveCard } from '../../lib/components/builder/NoteAggiuntiveCard';
import { VociPreventivoCard } from '../../lib/components/builder/VociPreventivoCard';
import { BuilderHeader } from '../../lib/components/builder/BuilderHeader';
import { GeneraPdfButton } from '../../lib/components/builder/GeneraPdfButton';
import { ClienteModal } from '../../lib/components/builder/ClienteModal';
import { AnalisiFiscaleCard } from '../../lib/components/builder/AnalisiFiscaleCard';
import { meseCorrenteString } from 'previcloud-shared';

export { resetBuilderState };

export default function Builder() {
  const [servizi, setServizi] = useState<Servizio[]>([])
  const [voci, setVoci] = useState<VocePreventivo[]>(builderState.voci)
  const [nomeCliente, setNomeCliente] = useState(builderState.nomeCliente)
  const [noteExtra, setNoteExtra] = useState(builderState.noteExtra)
  const [includiIva, setIncludiIva] = useState(builderState.includiIva)
  const [profiloFiscale, setProfiloFiscale] = useState<ProfiloFiscale | null>(null)
  const [mostraFiscale, setMostraFiscale] = useState(true)
  const [clienti, setClienti] = useState<Cliente[]>([])
  const [clienteSelezionato, setClienteSelezionato] = useState<Cliente | null>(null)
  const [mostraModalCliente, setMostraModalCliente] = useState(false)
  const [modalTab, setModalTab] = useState<'esistente' | 'nuovo'>('esistente')
  const [nuovoCliente, setNuovoCliente] = useState({ nome: '', telefono: '', email: '', indirizzo: '' })
  const [salvandoCliente, setSalvandoCliente] = useState(false)
  const [metodiPagamento, setMetodiPagamento] = useState<any[]>([metodoContantiDefault])
  const [metodoPagamentoSelezionato, setMetodoPagamentoSelezionato] = useState<any | null>(null)
  const [metodoPagamentoNessuno, setMetodoPagamentoNessuno] = useState(builderState.metodoPagamentoNessuno)
  const [nettoDesiderato, setNettoDesiderato] = useState('')
  const [lordomCalcolato, setLordoCalcolato] = useState<number | null>(null)
  const [ricercaCliente, setRicercaCliente] = useState("")
  const [trasferte, setTrasferte] = useState<TrasfertaBuilder[]>(builderState.trasferte)
  const [mostraTrasferte, setMostraTrasferte] = useState(builderState.mostraTrasferte)
  const [nuovaSpesaNome, setNuovaSpesaNome] = useState(builderState.nuovaSpesaNome)
  const [nuovaSpesaImporto, setNuovaSpesaImporto] = useState(builderState.nuovaSpesaImporto)
  const [nuoviKm, setNuoviKm] = useState(builderState.nuoviKm)
  const [scontoAttivo, setScontoAttivo] = useState(builderState.scontoAttivo)
  const [scontoTipo, setScontoTipo] = useState<'percentuale' | 'fisso'>(builderState.scontoTipo)
  const [scontoValore, setScontoValore] = useState(builderState.scontoValore)
  const [abbonamentoAttivo, setAbbonamentoAttivo] = useState(builderState.abbonamentoAttivo)
  const [abImporto, setAbImporto] = useState(builderState.abImporto)
  const [abGiorno, setAbGiorno] = useState(builderState.abGiorno)
  const [abMeseInizio, setAbMeseInizio] = useState(builderState.abMeseInizio)
  const [abMensilita, setAbMensilita] = useState(builderState.abMensilita)
  const [abVisibileNelPDF, setAbVisibileNelPDF] = useState(builderState.abVisibileNelPDF)
  const [pagamentoRateAttivo, setPagamentoRateAttivo] = useState(builderState.pagamentoRateAttivo)
  const [rateNumero, setRateNumero] = useState(builderState.rateNumero)
  const [rateGiornoScadenza, setRateGiornoScadenza] = useState(builderState.rateGiornoScadenza)
  const [rateMeseInizio, setRateMeseInizio] = useState(builderState.rateMeseInizio)
  const [rateVisibileNelPDF, setRateVisibileNelPDF] = useState(builderState.rateVisibileNelPDF)
  const [storicoVoci, setStoricoVoci] = useState<VocePreventivo[][]>([])
  const [mostraModalVoceCustom, setMostraModalVoceCustom] = useState(false)
  const [voceCustom, setVoceCustom] = useState({ nome: '', descrizione: '', costo: '', quantita: '1', unita: 'cad', salvaNelListino: false })
  const [salvandoVoceCustom, setSalvandoVoceCustom] = useState(false)
  const params = useLocalSearchParams<{
    cliente_id?: string
    cliente_nome?: string
    modifica?: string
    testo_modifica?: string
    versione_padre_id?: string
    versione_numero?: string
  }>()
  const modifica = risolviModifica(params)
  const testoModifica = modifica?.testoPreventivo || ''
  const inModifica = Boolean(testoModifica)
  const insets = useSafeAreaInsets()
  const modificaCaricata = useRef(false)
  const scrollRef = useRef<ScrollView>(null)
  const bozzaGestitaRef = useRef(false)
  const bloccoSalvataggioBozzaRef = useRef(false)
  const clienteBozzaVerificatoRef = useRef(false)
  const primoFocusBuilderRef = useRef(true)
  const [avvisoBozza, setAvvisoBozza] = useState<string | null>(null)
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  const [pagamentoImportato, setPagamentoImportato] = useState('')
  const [datiBuilderPronti, setDatiBuilderPronti] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow'
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide'
    const showSub = Keyboard.addListener(showEvent, e => setKeyboardHeight(e.endCoordinates.height))
    const hideSub = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0))
    return () => {
      showSub.remove()
      hideSub.remove()
    }
  }, [])

  function scrollCampoInVista() {
    setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), Platform.OS === 'ios' ? 100 : 250)
  }

  useEffect(() => {
    trackEvento('schermata_aperta', 'builder')
    void currentUserId().then(setUserId)
    caricaServizi()
    caricaProfiloFiscale()
    caricaClienti()
    caricaMetodiPagamento()
    if (params.cliente_id && params.cliente_nome) {
      setClienteSelezionato({ id: params.cliente_id, nome: params.cliente_nome, telefono: null, email: null, indirizzo: null })
    }
  }, [])

  useEffect(() => {
    if (!testoModifica) return

    const parsed = parsePreventivoTesto(testoModifica)
    setVoci(vociParsedConServizioId(collegaVociAlListino(parsed.voci, servizi)))

    if (modificaCaricata.current) return
    modificaCaricata.current = true

    setNoteExtra(parsed.noteExtra)
    setIncludiIva(parsed.includiIva)
    setTrasferte(parsed.trasferte)
    setMostraTrasferte(parsed.trasferte.length > 0)
    if (parsed.sconto) {
      setScontoAttivo(true)
      setScontoTipo(parsed.sconto.tipo)
      setScontoValore(String(parsed.sconto.valore))
    } else {
      setScontoAttivo(false)
      setScontoTipo('percentuale')
      setScontoValore('')
    }
    setPagamentoImportato(parsed.pagamentoNome)

    const clienteId = modifica?.clienteId || params.cliente_id
    const clienteNome = modifica?.clienteNome || params.cliente_nome
    if (clienteId && clienteNome) {
      setClienteSelezionato({ id: clienteId, nome: clienteNome, telefono: null, email: null, indirizzo: null })
    } else if (parsed.nomeCliente) {
      setNomeCliente(parsed.nomeCliente)
    }
  }, [testoModifica, servizi, modifica?.clienteId, modifica?.clienteNome, params.cliente_id, params.cliente_nome])

  useEffect(() => {
    if (!pagamentoImportato || metodiPagamento.length <= 1) return
    const trovato = trovaMetodoPagamentoDaNome(metodiPagamento, pagamentoImportato)
    if (trovato) {
      setMetodoPagamentoSelezionato(trovato)
      setMetodoPagamentoNessuno(false)
    }
  }, [pagamentoImportato, metodiPagamento])

  useEffect(() => {
    builderState.voci = voci
    builderState.nomeCliente = nomeCliente
    builderState.noteExtra = noteExtra
    builderState.includiIva = includiIva
    builderState.trasferte = trasferte
    builderState.mostraTrasferte = mostraTrasferte
    builderState.nuovaSpesaNome = nuovaSpesaNome
    builderState.nuovaSpesaImporto = nuovaSpesaImporto
    builderState.nuoviKm = nuoviKm
    builderState.scontoAttivo = scontoAttivo
    builderState.scontoTipo = scontoTipo
    builderState.scontoValore = scontoValore
    builderState.abbonamentoAttivo = abbonamentoAttivo
    builderState.abImporto = abImporto
    builderState.abGiorno = abGiorno
    builderState.abMeseInizio = abMeseInizio
    builderState.abMensilita = abMensilita
    builderState.abVisibileNelPDF = abVisibileNelPDF
    builderState.pagamentoRateAttivo = pagamentoRateAttivo
    builderState.rateNumero = rateNumero
    builderState.rateGiornoScadenza = rateGiornoScadenza
    builderState.rateMeseInizio = rateMeseInizio
    builderState.rateVisibileNelPDF = rateVisibileNelPDF
    builderState.metodoPagamentoNessuno = metodoPagamentoNessuno
    builderState.metodoPagamentoId = metodoPagamentoNessuno ? null : (metodoPagamentoSelezionato?.id ?? null)
    builderState.cliente = clienteSelezionato
      ? {
          id: clienteSelezionato.id,
          nome: clienteSelezionato.nome,
          telefono: clienteSelezionato.telefono ?? null,
          email: clienteSelezionato.email ?? null,
          indirizzo: clienteSelezionato.indirizzo ?? null,
        }
      : null
  }, [voci, nomeCliente, noteExtra, includiIva, trasferte, mostraTrasferte, nuovaSpesaNome, nuovaSpesaImporto, nuoviKm, scontoAttivo, scontoTipo, scontoValore, abbonamentoAttivo, abImporto, abGiorno, abMeseInizio, abMensilita, abVisibileNelPDF, pagamentoRateAttivo, rateNumero, rateGiornoScadenza, rateMeseInizio, rateVisibileNelPDF, metodoPagamentoNessuno, metodoPagamentoSelezionato, clienteSelezionato])

  useFocusEffect(
    useCallback(() => {
      if (primoFocusBuilderRef.current) {
        primoFocusBuilderRef.current = false
        return
      }

      const bs = builderState
      const bsClienteId = bs.cliente?.id ?? null

      setClienteSelezionato((prev) => {
        const prevId = prev?.id ?? null
        if (prevId === bsClienteId) return prev
        if (!bs.cliente) return null
        return {
          id: bs.cliente.id,
          nome: bs.cliente.nome,
          telefono: bs.cliente.telefono,
          email: bs.cliente.email,
          indirizzo: bs.cliente.indirizzo,
        }
      })

      setMetodoPagamentoNessuno((prev) =>
        prev === bs.metodoPagamentoNessuno ? prev : bs.metodoPagamentoNessuno,
      )
      if (bs.metodoPagamentoNessuno) {
        setMetodoPagamentoSelezionato((prev: any | null) => (prev === null ? prev : null))
      } else {
        setMetodoPagamentoSelezionato((prev: any | null) => {
          const prevId = prev?.id ?? null
          if (prevId === bs.metodoPagamentoId) return prev
          if (!bs.metodoPagamentoId) return null
          return metodiPagamento.find((m) => m.id === bs.metodoPagamentoId) ?? null
        })
      }

      setAbbonamentoAttivo((prev) => (prev === bs.abbonamentoAttivo ? prev : bs.abbonamentoAttivo))
      setAbImporto((prev) => (prev === bs.abImporto ? prev : bs.abImporto))
      setAbGiorno((prev) => (prev === bs.abGiorno ? prev : bs.abGiorno))
      setAbMeseInizio((prev) => (prev === bs.abMeseInizio ? prev : bs.abMeseInizio))
      setAbMensilita((prev) => (prev === bs.abMensilita ? prev : bs.abMensilita))
      setAbVisibileNelPDF((prev) => (prev === bs.abVisibileNelPDF ? prev : bs.abVisibileNelPDF))

      setPagamentoRateAttivo((prev) => (prev === bs.pagamentoRateAttivo ? prev : bs.pagamentoRateAttivo))
      setRateNumero((prev) => (prev === bs.rateNumero ? prev : bs.rateNumero))
      setRateGiornoScadenza((prev) => (prev === bs.rateGiornoScadenza ? prev : bs.rateGiornoScadenza))
      setRateMeseInizio((prev) => (prev === bs.rateMeseInizio ? prev : bs.rateMeseInizio))
      setRateVisibileNelPDF((prev) => (prev === bs.rateVisibileNelPDF ? prev : bs.rateVisibileNelPDF))
    }, [metodiPagamento]),
  )

  useEffect(() => {
    const reset = () => ripristina()
    eventBus.on('reset-builder', reset)
    return () => { eventBus.off('reset-builder', reset) }
  }, [])

  useEffect(() => {
    if (inModifica || bozzaGestitaRef.current || !datiBuilderPronti || !userId) return

    void (async () => {
      const draft = await caricaBozzaBuilder(userId)
      if (!draft || bozzaBuilderVuota(draft)) {
        bozzaGestitaRef.current = true
        return
      }

      if (!bozzaBuilderVuotaDaState({
        ...builderState,
        clienteSelezionatoId: clienteSelezionato?.id,
      })) {
        bozzaGestitaRef.current = true
        return
      }

      bozzaGestitaRef.current = true
      Alert.alert(
        'Preventivo in corso',
        messaggioRipresaBozza(draft),
        [
          {
            text: 'Inizia nuovo',
            style: 'destructive',
            onPress: () => ripristina(),
          },
          {
            text: 'Riprendi bozza',
            onPress: () => applicaBozzaDraft(draft),
          },
        ],
        { cancelable: false },
      )
    })()
  }, [inModifica, datiBuilderPronti, userId])

  useEffect(() => {
    if (inModifica || clienteBozzaVerificatoRef.current || clienti.length === 0) return

    const idDaVerificare = clienteSelezionato?.id
    clienteBozzaVerificatoRef.current = true
    if (!idDaVerificare) return

    void clienteIdUtilizzabile(idDaVerificare).then((ok) => {
      if (ok) return

      setClienteSelezionato(null)
      setAbbonamentoAttivo(false)
      setPagamentoRateAttivo(false)
      setAvvisoBozza('Il cliente precedentemente selezionato non è più disponibile')
    })
  }, [clienti.length, inModifica, clienteSelezionato?.id])

  useEffect(() => {
    if (inModifica || bloccoSalvataggioBozzaRef.current || !userId) return

    const timeout = setTimeout(() => {
      void salvaBozzaBuilder(userId, snapshotBozzaBuilder())
    }, 800)

    return () => clearTimeout(timeout)
  }, [
    inModifica,
    userId,
    voci,
    nomeCliente,
    noteExtra,
    includiIva,
    trasferte,
    mostraTrasferte,
    nuovaSpesaNome,
    nuovaSpesaImporto,
    nuoviKm,
    scontoAttivo,
    scontoTipo,
    scontoValore,
    abbonamentoAttivo,
    abImporto,
    abGiorno,
    abMeseInizio,
    abMensilita,
    abVisibileNelPDF,
    pagamentoRateAttivo,
    rateNumero,
    rateGiornoScadenza,
    rateMeseInizio,
    rateVisibileNelPDF,
    metodoPagamentoNessuno,
    metodoPagamentoSelezionato,
    clienteSelezionato,
  ])

  async function caricaMetodiPagamento() {
    const { metodiPagamento, predefinito } = await caricaMetodiPagamentoBuilder()
    if (!metodiPagamento) {
      setDatiBuilderPronti(true)
      return
    }

    setMetodiPagamento(metodiPagamento)

    if (builderState.metodoPagamentoNessuno) {
      setMetodoPagamentoNessuno(true)
      setMetodoPagamentoSelezionato(null)
      setDatiBuilderPronti(true)
      return
    }

    if (builderState.metodoPagamentoId) {
      const trovato = metodiPagamento.find((m) => m.id === builderState.metodoPagamentoId)
      if (trovato) {
        setMetodoPagamentoSelezionato(trovato)
        setDatiBuilderPronti(true)
        return
      }
    }

    if (predefinito && !inModifica) {
      setMetodoPagamentoSelezionato(predefinito)
      setMetodoPagamentoNessuno(false)
    }
    setDatiBuilderPronti(true)
  }

  async function caricaServizi() {
    const data = await caricaServiziBuilder()
    if (data) setServizi(data)
  }

  async function caricaClienti() {
    const data = await caricaClientiBuilder()
    if (data) setClienti(data)
  }

  async function salvaESelezionaCliente() {
    if (!nuovoCliente.nome.trim()) return
    setSalvandoCliente(true)
    const data = await creaClienteBuilder(nuovoCliente)
    if (data) {
      setClienteSelezionato(data)
      setClienti(c => [...c, data])
    }
    setSalvandoCliente(false)
    setMostraModalCliente(false)
    setNuovoCliente({ nome: '', telefono: '', email: '', indirizzo: '' })
  }

  async function caricaProfiloFiscale() {
    const data = await caricaProfiloFiscaleBuilder()
    if (data) setProfiloFiscale(data)
  }

  function snapshotBozzaBuilder(): BuilderDraft {
    return buildBuilderDraft(
      {
        voci,
        nomeCliente,
        noteExtra,
        includiIva,
        trasferte,
        mostraTrasferte,
        nuovaSpesaNome,
        nuovaSpesaImporto,
        nuoviKm,
        scontoAttivo,
        scontoTipo,
        scontoValore,
        abbonamentoAttivo,
        abImporto,
        abGiorno,
        abMeseInizio,
        abMensilita,
        abVisibileNelPDF,
        pagamentoRateAttivo,
        rateNumero,
        rateGiornoScadenza,
        rateMeseInizio,
        rateVisibileNelPDF,
        metodoPagamentoNessuno,
        metodoPagamentoId: metodoPagamentoNessuno ? null : (metodoPagamentoSelezionato?.id ?? null),
        nascondiPrezzi: builderState.nascondiPrezzi,
      },
      clienteSelezionato?.id || '',
      clienteSelezionato?.nome || '',
    )
  }

  function applicaBozzaDraft(draft: BuilderDraft) {
    applicaBozzaABuilderState(draft)
    setVoci(draft.voci)
    setNomeCliente(draft.nomeCliente)
    setNoteExtra(draft.noteExtra)
    setIncludiIva(draft.includiIva)
    setTrasferte(draft.trasferte)
    setMostraTrasferte(draft.mostraTrasferte)
    setNuovaSpesaNome(draft.nuovaSpesaNome)
    setNuovaSpesaImporto(draft.nuovaSpesaImporto)
    setNuoviKm(draft.nuoviKm)
    setScontoAttivo(draft.scontoAttivo ?? false)
    setScontoTipo(draft.scontoTipo ?? 'percentuale')
    setScontoValore(draft.scontoValore ?? '')
    setAbbonamentoAttivo(draft.abbonamentoAttivo)
    setAbImporto(draft.abImporto)
    setAbGiorno(draft.abGiorno)
    setAbMeseInizio(draft.abMeseInizio)
    setAbMensilita(draft.abMensilita)
    setAbVisibileNelPDF(draft.abVisibileNelPDF)
    setPagamentoRateAttivo(draft.pagamentoRateAttivo)
    setRateNumero(draft.rateNumero)
    setRateGiornoScadenza(draft.rateGiornoScadenza)
    setRateMeseInizio(draft.rateMeseInizio)
    setRateVisibileNelPDF(draft.rateVisibileNelPDF)
    setMetodoPagamentoNessuno(draft.metodoPagamentoNessuno)
    if (draft.clienteSelezionatoId && draft.clienteNome) {
      setClienteSelezionato({
        id: draft.clienteSelezionatoId,
        nome: draft.clienteNome,
        telefono: null,
        email: null,
        indirizzo: null,
      })
      clienteBozzaVerificatoRef.current = false
    } else {
      setClienteSelezionato(null)
    }
    if (draft.metodoPagamentoNessuno) {
      setMetodoPagamentoSelezionato(null)
    } else if (draft.metodoPagamentoId) {
      const trovato = metodiPagamento.find((m) => m.id === draft.metodoPagamentoId)
      setMetodoPagamentoSelezionato(trovato ?? null)
    }
  }

  function ripristina() {
    bloccoSalvataggioBozzaRef.current = true
    resetBuilderState()
    setVoci([])
    setNomeCliente('')
    setNoteExtra('')
    setIncludiIva(false)
    setClienteSelezionato(null)
    setTrasferte([])
    setMostraTrasferte(false)
    setNuovaSpesaNome('')
    setNuovaSpesaImporto('')
    setNuoviKm('')
    setScontoAttivo(false)
    setScontoTipo('percentuale')
    setScontoValore('')
    setAbbonamentoAttivo(false)
    setAbImporto('')
    setAbGiorno('1')
    setAbMeseInizio(meseCorrenteString())
    setAbMensilita('')
    setAbVisibileNelPDF(true)
    setPagamentoRateAttivo(false)
    setRateNumero('')
    setRateGiornoScadenza('1')
    setRateMeseInizio(meseCorrenteString())
    setRateVisibileNelPDF(true)
    setMetodoPagamentoSelezionato(null)
    setMetodoPagamentoNessuno(false)
    const cancella = userId ? cancellaBozzaBuilder(userId) : Promise.resolve()
    void cancella.finally(() => {
      bloccoSalvataggioBozzaRef.current = false
    })
  }


  function calcolaTotale() {
    return calcolaTotaleVoci(voci)
  }

  function calcolaFiscale() {
    return calcolaFiscalePreventivo(profiloFiscale, mostraFiscale, voci, trasferte, includiIva)
  }

  function calcolaLordoDaNetto(netto: number): number | null {
    return calcolaLordoDaNettoBuilder(netto, profiloFiscale)
  }

  function aggiungiVoce(s: Servizio) {
    if (voci.find(v => v.servizio_id === s.id)) {
      Alert.alert('Attenzione', 'Questo servizio è già nel preventivo.')
      return
    }
    setVoci(v => [...v, { servizio_id: s.id, nome: s.nome, descrizione: s.descrizione || '', costo: s.costo?.toString() || '', quantita: '1', unita: s.unita }])
  }

  function apriVoceCustom() {
    setVoceCustom({ nome: '', descrizione: '', costo: '', quantita: '1', unita: 'cad', salvaNelListino: false })
    setMostraModalVoceCustom(true)
  }

  async function confermaVoceCustom() {
    if (!voceCustom.nome.trim()) { Alert.alert('Errore', 'Inserisci almeno il nome del servizio'); return }
    setSalvandoVoceCustom(true)
    const costoNormalizzato = voceCustom.costo.trim().replace(',', '.')
    setVoci(v => [...v, {
      servizio_id: `custom-${Date.now()}`,
      nome: voceCustom.nome.trim(),
      descrizione: voceCustom.descrizione.trim(),
      costo: costoNormalizzato,
      quantita: voceCustom.quantita.trim() || '1',
      unita: voceCustom.unita,
    }])

    if (voceCustom.salvaNelListino) {
      const { data, error } = await creaServizioListino({ ...voceCustom, costo: costoNormalizzato, ordine: servizi.length })
      if (error) Alert.alert('Voce aggiunta', 'Aggiunta al preventivo, ma non salvata nel listino.')
      if (!error && data) setServizi(s => [...s, data])
    }

    setSalvandoVoceCustom(false)
    setMostraModalVoceCustom(false)
    setVoceCustom({ nome: '', descrizione: '', costo: '', quantita: '1', unita: 'cad', salvaNelListino: false })
  }

  function rimuoviVoce(id: string) { setVoci(v => v.filter(x => x.servizio_id !== id)) }
  function aggiornaVoce(id: string, campo: 'costo' | 'quantita' | 'descrizione', valore: string) {
    setVoci(v => v.map(x => x.servizio_id === id ? { ...x, [campo]: valore } : x))
  }

  function generaTestoPreventivo() {
    const valoreSconto = parseImportoEuro(scontoValore) ?? NaN
    return generaTestoPreventivoBuilder({
      nomeCliente,
      voci,
      trasferte,
      includiIva,
      noteExtra,
      metodoPagamentoSelezionato: metodoPagamentoNessuno ? null : metodoPagamentoSelezionato,
      sconto: scontoAttivo && scontoValore && valoreSconto > 0
        ? { tipo: scontoTipo, valore: valoreSconto }
        : null,
    })
  }

  function generaPDF() {
    if (voci.length === 0) { Alert.alert('Preventivo vuoto', 'Aggiungi almeno un servizio.'); return }
    const testo = generaTestoPreventivo()
    const mpId = metodoPagamentoNessuno ? '' : (metodoPagamentoSelezionato?.id || '')
    trackEvento('builder_pdf_generato', 'builder', { num_voci: voci.length, ha_trasferte: trasferte.length > 0 })
    router.push({
      pathname: '/screens/preventivo-pdf',
      params: {
        testo,
        cliente_id: clienteSelezionato?.id || params.cliente_id || '',
        metodo_pagamento_id: mpId,
        metodo_pagamento_nessuno: metodoPagamentoNessuno ? '1' : '0',
        importo_totale: totaleConSconto.toFixed(0),
        versione_padre_id: modifica?.versionePadreId || params.versione_padre_id || '',
        ab_attivo: abbonamentoAttivo ? '1' : '0',
        ab_importo: abImporto,
        ab_giorno: abGiorno,
        ab_mese_inizio: abMeseInizio,
        ab_mensilita: abMensilita,
        ab_visibile: abVisibileNelPDF ? '1' : '0',
        rate_attivo: pagamentoRateAttivo ? '1' : '0',
        rate_numero: rateNumero,
        rate_giorno: rateGiornoScadenza,
        rate_mese_inizio: rateMeseInizio,
        rate_visibile: rateVisibileNelPDF ? '1' : '0',
      }
    })
  }

  const totale = calcolaTotale()
  const totaleBase = calcolaTotaleVoci(voci) + calcolaTotaleTrasferte(trasferte)
  const totaleConIva = includiIva ? totaleBase * 1.22 : totaleBase
  const importoSconto = (() => {
    if (!scontoAttivo || !scontoValore) return 0
    const val = parseImportoEuro(scontoValore) ?? NaN
    if (isNaN(val) || val <= 0) return 0
    return scontoTipo === 'percentuale'
      ? totaleBase * (val / 100)
      : Math.min(val, totaleBase)
  })()
  const totaleNetto = Math.max(0, totaleBase - importoSconto)
  const totaleConSconto = includiIva ? totaleNetto * 1.22 : totaleNetto
  const f = calcolaFiscale()
  const fmt = formatImportoEuroVisuale

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <BuilderHeader
        onBack={() => router.back()}
        onRipristina={() => {
          Alert.alert('Ripristina', 'Vuoi svuotare il preventivo?', [
            { text: 'Annulla', style: 'cancel' },
            { text: 'Svuota', style: 'destructive', onPress: ripristina }
          ])
        }}
      />

      {avvisoBozza ? (
        <View style={styles.avvisoBozza}>
          <Text style={styles.avvisoBozzaText}>{avvisoBozza}</Text>
          <TouchableOpacity onPress={() => setAvvisoBozza(null)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
            <Text style={styles.avvisoBozzaClose}>×</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <ScrollView
        ref={scrollRef}
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          keyboardHeight > 0 && {
            paddingBottom: Platform.OS === 'ios' ? keyboardHeight + 24 : 48,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        automaticallyAdjustKeyboardInsets={Platform.OS === 'ios'}
      >

        <ClienteCard
          clienteSelezionato={clienteSelezionato}
          onOpenCliente={() => setMostraModalCliente(true)}
          onClearCliente={() => {
            setClienteSelezionato(null)
            setAbbonamentoAttivo(false)
            setPagamentoRateAttivo(false)
          }}
        />

        <ServiziListinoCard
          servizi={servizi}
          voci={voci}
          onConfiguraServizi={() => router.push('/screens/listino')}
          onAggiungiVoce={aggiungiVoce}
          onRimuoviVoce={rimuoviVoce}
          onAggiungiVoceCustom={apriVoceCustom}
        />

        <VociPreventivoCard
          voci={voci}
          includiIva={includiIva}
          totale={totale}
          totaleConIva={totaleConIva}
          onToggleIva={() => setIncludiIva(v => !v)}
          onRimuoviVoce={rimuoviVoce}
          onAggiornaVoce={aggiornaVoce}
        />

        <TrasferteCard
          trasferte={trasferte}
          setTrasferte={setTrasferte}
          mostraTrasferte={mostraTrasferte}
          setMostraTrasferte={setMostraTrasferte}
          nuoviKm={nuoviKm}
          setNuoviKm={setNuoviKm}
          nuovaSpesaNome={nuovaSpesaNome}
          setNuovaSpesaNome={setNuovaSpesaNome}
          nuovaSpesaImporto={nuovaSpesaImporto}
          setNuovaSpesaImporto={setNuovaSpesaImporto}
        />

        <ScontoCard
          scontoAttivo={scontoAttivo}
          scontoTipo={scontoTipo}
          scontoValore={scontoValore}
          onToggle={() => setScontoAttivo(v => !v)}
          onChangeTipo={setScontoTipo}
          onChangeValore={setScontoValore}
          totaleBase={totaleBase}
        />

        <NoteAggiuntiveCard
          noteExtra={noteExtra}
          setNoteExtra={setNoteExtra}
          onInputFocus={scrollCampoInVista}
        />

        <AnalisiFiscaleCard
          profiloFiscale={profiloFiscale}
          mostraFiscale={mostraFiscale}
          setMostraFiscale={setMostraFiscale}
          fiscale={f}
          voci={voci}
          setVoci={setVoci}
          storicoVoci={storicoVoci}
          setStoricoVoci={setStoricoVoci}
          nettoDesiderato={nettoDesiderato}
          setNettoDesiderato={setNettoDesiderato}
          lordomCalcolato={lordomCalcolato}
          setLordoCalcolato={setLordoCalcolato}
          calcolaLordoDaNetto={calcolaLordoDaNetto}
          calcolaTotale={calcolaTotale}
          fmt={fmt}
          onInputFocus={scrollCampoInVista}
        />

      </ScrollView>

      {keyboardHeight === 0 && (
        <GeneraPdfButton
          disabled={voci.length === 0}
          totaleConIva={totaleConSconto}
          onPress={generaPDF}
          bottomInset={insets.bottom}
        />
      )}

      <VoceCustomModal
        visible={mostraModalVoceCustom}
        voceCustom={voceCustom}
        salvando={salvandoVoceCustom}
        onClose={() => setMostraModalVoceCustom(false)}
        onConfirm={confermaVoceCustom}
        setVoceCustom={setVoceCustom}
      />

      <ClienteModal
        visible={mostraModalCliente}
        clienti={clienti}
        clienteSelezionato={clienteSelezionato}
        modalTab={modalTab}
        setModalTab={setModalTab}
        ricercaCliente={ricercaCliente}
        setRicercaCliente={setRicercaCliente}
        nuovoCliente={nuovoCliente}
        setNuovoCliente={setNuovoCliente}
        salvandoCliente={salvandoCliente}
        onClose={() => setMostraModalCliente(false)}
        onSelectCliente={(cliente) => { setClienteSelezionato(cliente); setMostraModalCliente(false) }}
        onSalvaCliente={salvaESelezionaCliente}
      />
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scrollView: { flex: 1 },
  scrollContent: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14, gap: 22 },
  avvisoBozza: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 16,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FEF3C7',
    borderWidth: 1,
    borderColor: '#FDE68A',
  },
  avvisoBozzaText: { flex: 1, fontSize: 12, color: '#92400E', lineHeight: 16 },
  avvisoBozzaClose: { fontSize: 18, color: '#92400E', lineHeight: 18 },
})
