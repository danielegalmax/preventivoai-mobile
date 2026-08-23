import * as FileSystem from 'expo-file-system/legacy'
import { router, useLocalSearchParams } from 'expo-router'
import { useEffect, useRef, useState } from 'react'
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { generaPDF as generaPDFApi, generaPDFFile, salvaPDF as salvaPDFApi, creaLinkPagamento } from "../../lib/api/pdf"
import {
  PreventivoPdfClienteButton,
  PreventivoPdfFooter,
} from '../../lib/components/preventivoPdf/PreventivoPdfActions'
import { PreventivoPdfHeader } from '../../lib/components/preventivoPdf/PreventivoPdfHeader'
import { PreventivoPdfClienteModal } from '../../lib/components/preventivoPdf/PreventivoPdfModals'
import { BuilderPagamentoRateCard } from '../../lib/components/builder/BuilderPagamentoRateCard'
import { PagamentoCard } from '../../lib/components/builder/PagamentoCard'
import { MetodoPagamentoModal } from '../../lib/components/builder/MetodoPagamentoModal'
import {
  PreventivoPdfAbbonamentoCard,
  PreventivoPdfTariffaToggle,
} from '../../lib/components/preventivoPdf/PreventivoPdfOptionsCards'
import { PreventivoPdfPreviewCard } from '../../lib/components/preventivoPdf/PreventivoPdfPreviewCard'
import { PreventivoPdfSuccessModal, type PdfSuccessInvio } from '../../lib/components/preventivoPdf/PreventivoPdfSuccessModal'
import { PreventivoPdfTemplatePicker } from '../../lib/components/preventivoPdf/PreventivoPdfTemplatePicker'
import { eventBus } from '../../lib/eventBus'
import { scalaHtmlPreview } from '../../lib/features/preventivoPdf/text'
import { testoConPagamento } from 'previcloud-shared'
import { importoDaTesto, meseCorrenteString, parseImportoEuro, validaPianiPagamento } from 'previcloud-shared'
import {
  caricaClientePreventivo,
  caricaClientiPreventivo,
  caricaMetodiPagamentoPreventivo,
  caricaTemplatePreferito,
  creaAbbonamentoDaPreventivo,
  creaPianoRateDaPreventivo,
  creaClientePreventivo,
  ClientePreventivo,
  MetodoPagamento,
  salvaPreventivoPdf,
  salvaTemplatePreferito,
  tokenPreventivoPdf,
} from '../../lib/api/preventivoPdf'
import { statoAccount } from '../../lib/api/stripeConnect'
import { confermaPagamentoEsclusivo } from '../../lib/utils/confermaPagamentoEsclusivo'
import { trackEvento } from '../../lib/api/track'
import { currentUserId } from '../../lib/api/auth'
import { richiestaRecensioneSeOpportuno } from '../../lib/storeReview'
import { errorMessage } from '../../lib/utils/errors'
import { supabase } from '../../lib/supabase'
import { resetBuilderState } from './builder'
import { bozzaBuilderVuota, cancellaBozzaBuilder, caricaBozzaBuilder, salvaBozzaBuilder } from '../../lib/builder/draft'
import { builderState } from '../../lib/builder/state'

type Params = {
  testo: string
  versione_padre_id: string
  cliente_id: string
  metodo_pagamento_id: string
  metodo_pagamento_nessuno?: string
  importo_totale: string
  ab_attivo?: string
  ab_importo?: string
  ab_giorno?: string
  ab_mensilita?: string
  ab_mese_inizio?: string
  ab_visibile?: string
  rate_attivo?: string
  rate_numero?: string
  rate_giorno?: string
  rate_mese_inizio?: string
  rate_visibile?: string
}

export default function PreventivoPDF() {
  const {
    testo: testoParam,
    versione_padre_id,
    cliente_id,
    metodo_pagamento_id,
    metodo_pagamento_nessuno,
    importo_totale,
    ab_attivo,
    ab_importo,
    ab_giorno,
    ab_mensilita,
    ab_mese_inizio,
    ab_visibile,
    rate_attivo,
    rate_numero,
    rate_giorno,
    rate_mese_inizio,
    rate_visibile,
  } = useLocalSearchParams<Params>()

  const insets = useSafeAreaInsets()
  const [testo] = useState(testoParam || '')
  const [template, setTemplate] = useState('pulito')
  const [generando, setGenerando] = useState(false)
  const [token, setToken] = useState('')
  const [clienti, setClienti] = useState<ClientePreventivo[]>([])
  const [clienteSelezionato, setClienteSelezionato] = useState<ClientePreventivo | null>(null)
  const [mostraModalCliente, setMostraModalCliente] = useState(false)
  const [nuovoNomeCliente, setNuovoNomeCliente] = useState('')
  const [modalTab, setModalTab] = useState<'esistente' | 'nuovo'>('esistente')
  const [nascondiPrezzi, setNascondiPrezzi] = useState(builderState.nascondiPrezzi)
  const [htmlPreview, setHtmlPreview] = useState('')
  const [caricandoPreview, setCaricandoPreview] = useState(false)
  const [metodiPagamento, setMetodiPagamento] = useState<MetodoPagamento[]>([])
  const [metodoPagamentoSelezionato, setMetodoPagamentoSelezionato] = useState<MetodoPagamento | null>(null)
  const [metodoPagamentoNessuno, setMetodoPagamentoNessuno] = useState(false)
  const [stripeChargesEnabled, setStripeChargesEnabled] = useState(false)
  const [mostraModalPagamento, setMostraModalPagamento] = useState(false)
  const [abbonamentoAttivo, setAbbonamentoAttivo] = useState(false)
  const [abImporto, setAbImporto] = useState('')
  const [abGiorno, setAbGiorno] = useState('1')
  const [abMeseInizio, setAbMeseInizio] = useState(meseCorrenteString())
  const [abMensilita, setAbMensilita] = useState('')
  const [abVisibileNelPDF, setAbVisibileNelPDF] = useState(true)
  const [pagamentoRateAttivo, setPagamentoRateAttivo] = useState(false)
  const [rateNumero, setRateNumero] = useState('')
  const [rateGiornoScadenza, setRateGiornoScadenza] = useState('1')
  const [rateMeseInizio, setRateMeseInizio] = useState(meseCorrenteString())
  const [rateVisibileNelPDF, setRateVisibileNelPDF] = useState(true)
  const previewTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [modalPdfSuccesso, setModalPdfSuccesso] = useState<{
    pdfUri: string
    dettaglio: string
    invio: PdfSuccessInvio
  } | null>(null)
  const [mostraToastSalvato, setMostraToastSalvato] = useState(false)

  async function caricaStripeStato() {
    try {
      const s = await statoAccount()
      setStripeChargesEnabled(s.stripe_charges_enabled)
    } catch {
      setStripeChargesEnabled(false)
    }
  }

  useEffect(() => {
    trackEvento('schermata_aperta', 'preventivo_pdf')
    tokenPreventivoPdf().then(setToken)
    caricaTemplatePref()
    caricaClienti()
    caricaMetodiPagamento()
    void caricaStripeStato()
  }, [])

  useEffect(() => {
    if (cliente_id) {
      caricaClientePreventivo(cliente_id).then(data => { if (data) setClienteSelezionato(data) })
    }
  }, [cliente_id])

  useEffect(() => {
    if (ab_attivo === '1') setAbbonamentoAttivo(true)
    if (ab_importo) setAbImporto(ab_importo)
    if (ab_giorno) setAbGiorno(ab_giorno)
    if (ab_mese_inizio) setAbMeseInizio(ab_mese_inizio)
    if (ab_mensilita) setAbMensilita(ab_mensilita)
    if (ab_visibile === '0') setAbVisibileNelPDF(false)
  }, [ab_attivo, ab_importo, ab_giorno, ab_mese_inizio, ab_mensilita, ab_visibile])

  useEffect(() => {
    if (rate_attivo === '1') setPagamentoRateAttivo(true)
    if (rate_numero) setRateNumero(rate_numero)
    if (rate_giorno) setRateGiornoScadenza(rate_giorno)
    if (rate_mese_inizio) setRateMeseInizio(rate_mese_inizio)
    if (rate_visibile === '0') setRateVisibileNelPDF(false)
  }, [rate_attivo, rate_numero, rate_giorno, rate_mese_inizio, rate_visibile])

  useEffect(() => {
    builderState.nascondiPrezzi = nascondiPrezzi
    builderState.cliente = clienteSelezionato
      ? {
          id: clienteSelezionato.id,
          nome: clienteSelezionato.nome,
          telefono: null,
          email: null,
          indirizzo: null,
        }
      : null
    builderState.metodoPagamentoNessuno = metodoPagamentoNessuno
    builderState.metodoPagamentoId = metodoPagamentoNessuno
      ? null
      : (metodoPagamentoSelezionato?.id ?? null)
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

    const timeout = setTimeout(() => {
      void (async () => {
        const userId = await currentUserId()
        if (!userId) return
        const draft = await caricaBozzaBuilder(userId)
        if (!draft || bozzaBuilderVuota(draft)) return
        await salvaBozzaBuilder(userId, { ...draft, nascondiPrezzi })
      })()
    }, 800)
    return () => clearTimeout(timeout)
  }, [
    nascondiPrezzi,
    clienteSelezionato,
    metodoPagamentoNessuno,
    metodoPagamentoSelezionato,
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
  ])

  const importoTotaleNum = importo_totale
    ? (parseImportoEuro(String(importo_totale)) ?? 0)
    : 0

  useEffect(() => {
    if (!token || !testo) return
    if (previewTimeout.current) clearTimeout(previewTimeout.current)
    previewTimeout.current = setTimeout(() => aggiornaPreview(), 300)
  }, [template, token, testo, clienteSelezionato, nascondiPrezzi, metodoPagamentoSelezionato, metodoPagamentoNessuno, abbonamentoAttivo, abImporto, abGiorno, abMeseInizio, abMensilita, abVisibileNelPDF, pagamentoRateAttivo, rateNumero, rateGiornoScadenza, rateMeseInizio, rateVisibileNelPDF, importo_totale])

  function onChangeAbbonamentoAttivo(v: boolean) {
    if (!v) {
      setAbbonamentoAttivo(false)
      return
    }
    confermaPagamentoEsclusivo('canone', pagamentoRateAttivo, () => {
      setPagamentoRateAttivo(false)
      setAbbonamentoAttivo(true)
    })
  }

  function onChangePagamentoRateAttivo(v: boolean) {
    if (!v) {
      setPagamentoRateAttivo(false)
      return
    }
    confermaPagamentoEsclusivo('rate', abbonamentoAttivo, () => {
      setAbbonamentoAttivo(false)
      setPagamentoRateAttivo(true)
    })
  }

  async function buildTestoConPagamento(preventivoId: string) {
    const importoRate = importoTotaleNum > 0 ? importoTotaleNum : (importoDaTesto(testo) ?? 0)
    return testoConPagamento({
      testo,
      preventivoId,
      abbonamentoAttivo,
      abVisibileNelPDF,
      abImporto,
      abGiorno,
      abMeseInizio: parseInt(abMeseInizio, 10) || 0,
      abMensilita,
      pagamentoRateAttivo,
      rateVisibileNelPDF,
      rateImportoTotale: importoRate,
      rateNumero: parseInt(rateNumero, 10) || 0,
      rateGiornoScadenza: parseInt(rateGiornoScadenza, 10) || 0,
      rateMeseInizio: parseInt(rateMeseInizio, 10) || 0,
      metodoPagamento: metodoPagamentoNessuno ? null : metodoPagamentoSelezionato,
      token,
      creaLinkPagamento,
    })
  }

  async function aggiornaPreview() {
    if (!token || !testo) return
    setCaricandoPreview(true)
    try {
      const data = await generaPDFApi({
        testo: await buildTestoConPagamento(''),
        template,
        token,
        versione_padre_id: null,
        cliente_id: clienteSelezionato?.id || '',
        nascondi_prezzi: nascondiPrezzi,
      })
      if (data.html) setHtmlPreview(scalaHtmlPreview(data.html))
    } catch {
      return
    }
    setCaricandoPreview(false)
  }

  async function caricaTemplatePref() {
    const templatePreferito = await caricaTemplatePreferito()
    if (templatePreferito) setTemplate(templatePreferito)
  }

  async function caricaClienti() {
    const data = await caricaClientiPreventivo()
    if (data === null) {
      Alert.alert('Errore', 'Impossibile caricare i clienti.')
      setClienti([])
      return
    }
    setClienti(data)
  }

  async function caricaMetodiPagamento() {
    const data = await caricaMetodiPagamentoPreventivo()
    if (data === null) {
      Alert.alert('Errore', 'Impossibile caricare i metodi di pagamento.')
      setMetodiPagamento([])
      return
    }
    setMetodiPagamento(data)
    if (metodo_pagamento_nessuno === '1') {
      setMetodoPagamentoSelezionato(null)
      setMetodoPagamentoNessuno(true)
      return
    }
    setMetodoPagamentoNessuno(false)
    const metodoDaParam = metodo_pagamento_id ? data.find(m => m.id === metodo_pagamento_id) : null
    const predefinito = data.find(m => m.predefinito)
    if (metodoDaParam || predefinito) setMetodoPagamentoSelezionato(metodoDaParam || predefinito || null)
  }

  async function aggiungiESelezionaCliente() {
    if (!nuovoNomeCliente.trim()) return
    const data = await creaClientePreventivo(nuovoNomeCliente)
    if (!data) {
      Alert.alert('Errore', 'Impossibile creare il cliente, riprova.')
      return
    }
    setClienteSelezionato({ id: data.id, nome: data.nome })
    setClienti(c => [...c, { id: data.id, nome: data.nome }])
    setMostraModalCliente(false)
    setNuovoNomeCliente('')
  }

  async function generaPDF() {
    const errPiani = validaPianiPagamento({
      pagamentoRateAttivo,
      abbonamentoAttivo,
      clienteCollegato: Boolean(clienteSelezionato?.id),
      rateNumero,
      rateGiornoScadenza,
      rateMeseInizio,
      abGiorno,
      abMeseInizio,
    })
    if (errPiani) {
      Alert.alert('Attenzione', errPiani)
      return
    }
    setGenerando(true)
    try {
      const testoFinale = await buildTestoConPagamento('')
      const data = await generaPDFFile({
        testo: testoFinale,
        template,
        token,
        versione_padre_id: versione_padre_id || null,
        cliente_id: clienteSelezionato?.id || '',
        nascondi_prezzi: nascondiPrezzi,
      })
      const uri = `${FileSystem.cacheDirectory}preventivo-${Date.now()}.pdf`
      await FileSystem.writeAsStringAsync(uri, data.pdf_base64, { encoding: 'base64' as FileSystem.EncodingType })

      let pdfUrl = ''
      let uploadOk = false
      try {
        pdfUrl = await salvaPDFApi(data.pdf_base64, token)
        uploadOk = !!pdfUrl
      } catch {
        uploadOk = false
      }

      const titoloAuto = clienteSelezionato
        ? `Preventivo ${clienteSelezionato.nome}`
        : `Preventivo ${new Date().toLocaleDateString('it-IT')}`

      await salvaEProseguiConSuccesso({ data, testoFinale, uri, pdfUrl, uploadOk, titoloAuto })
    } catch (err: unknown) {
      Alert.alert('Errore', errorMessage(err))
    }
    setGenerando(false)
  }

  // Riprende il salvataggio e i passi successivi (link Stripe, abbonamento/rate, modal
  // successo) usando il PDF già generato — su fallimento del salvataggio DB il "Riprova"
  // richiama questa stessa funzione senza rigenerare il PDF (costoso e non necessario).
  async function salvaEProseguiConSuccesso(params: {
    data: Awaited<ReturnType<typeof generaPDFFile>>
    testoFinale: string
    uri: string
    pdfUrl: string
    uploadOk: boolean
    titoloAuto: string
  }) {
    let { data, testoFinale, uri, pdfUrl, uploadOk } = params
    const { titoloAuto } = params
    const numeroPreventivo = data.numeroPreventivo || ''

    let idSalvato: string
    try {
      idSalvato = await salvaSuSupabase(data.versione, titoloAuto, pdfUrl, testoFinale)
    } catch (err: unknown) {
      Alert.alert(
        'Impossibile salvare il preventivo',
        'Il PDF è stato generato ma il salvataggio non è riuscito. Riprova prima di condividerlo con il cliente.',
        [
          { text: 'Annulla', style: 'cancel' },
          {
            text: 'Riprova salvataggio',
            onPress: () => {
              setGenerando(true)
              void salvaEProseguiConSuccesso(params).finally(() => setGenerando(false))
            },
          },
        ],
      )
      return
    }

    if (metodoPagamentoSelezionato?.tipo === 'stripe' && !metodoPagamentoNessuno) {
      const { payment_url } = await creaLinkPagamento(idSalvato, 'Preventivo', token)
      testoFinale = testoFinale.replace('[PAGAMENTO_ONLINE]', payment_url)
      data = await generaPDFFile({
        testo: testoFinale,
        template,
        token,
        versione_padre_id: versione_padre_id || null,
        cliente_id: clienteSelezionato?.id || '',
        nascondi_prezzi: nascondiPrezzi,
      })
      uri = `${FileSystem.cacheDirectory}preventivo-${Date.now()}.pdf`
      await FileSystem.writeAsStringAsync(uri, data.pdf_base64, { encoding: 'base64' as FileSystem.EncodingType })
      try {
        pdfUrl = await salvaPDFApi(data.pdf_base64, token)
        uploadOk = !!pdfUrl
      } catch {
        uploadOk = false
      }
      await supabase
        .from('preventivi')
        .update({
          testo_preventivo: testoFinale,
          pdf_url: pdfUrl || null,
        })
        .eq('id', idSalvato)
    }

    resetBuilderState()
    const userId = await currentUserId()
    if (userId) void cancellaBozzaBuilder(userId)
    eventBus.emit('reset-builder')

    if (abbonamentoAttivo && clienteSelezionato) {
      const abbonamento = await creaAbbonamentoDaPreventivo({
        cliente: clienteSelezionato,
        preventivoId: idSalvato,
        importoRaw: abImporto,
        giornoRaw: abGiorno,
        meseInizioRaw: abMeseInizio,
        mensilitaRaw: abMensilita,
      })
      if (abbonamento.esistente) {
        Alert.alert('Abbonamento esistente', 'Questo preventivo ha già un piano collegato. Gestiscilo dalla cartella cliente.')
      }
    }

    if (pagamentoRateAttivo && clienteSelezionato) {
      const importoRate = importoTotaleNum > 0 ? importoTotaleNum : (importoDaTesto(testo) ?? 0)
      const piano = await creaPianoRateDaPreventivo({
        cliente: clienteSelezionato,
        preventivoId: idSalvato,
        importoTotale: importoRate,
        numeroRateRaw: rateNumero,
        giornoScadenzaRaw: rateGiornoScadenza,
        meseInizioRaw: rateMeseInizio,
      })
      if (piano.esistente) {
        Alert.alert('Piano a rate esistente', `${clienteSelezionato.nome} ha già un piano a rate attivo. Gestiscilo dalla sua cartella cliente.`)
      }
    }

    setModalPdfSuccesso({
      pdfUri: uri,
      dettaglio: 'Preventivo salvato sul dispositivo.',
      invio: {
        preventivoId: idSalvato,
        clienteId: clienteSelezionato?.id,
        nomeCliente: clienteSelezionato?.nome,
        haStripe: testoFinale.includes('LINK PAGAMENTO:'),
        uploadOnlineOk: uploadOk,
        titoloIniziale: numeroPreventivo || titoloAuto,
        segnaInviatoDisponibile: true,
      },
    })
    void richiestaRecensioneSeOpportuno()
  }

  function chiudiModalPdfSuccesso() {
    setModalPdfSuccesso(null)
    setMostraToastSalvato(true)
    setTimeout(() => setMostraToastSalvato(false), 2500)
  }

  async function salvaSuSupabase(ver: number, titoloScelto: string, pdfUrl: string = '', testoSalvataggio?: string): Promise<string> {
    const importoParam = importo_totale ? parseImportoEuro(String(importo_totale)) : null
    const testoDaSalvare = testoSalvataggio ?? testo
    const importo = importoDaTesto(testoDaSalvare)
      ?? (importoParam != null && !Number.isNaN(importoParam) ? importoParam : null)
    return salvaPreventivoPdf({
      testo: testoDaSalvare,
      template,
      versione: ver,
      versionePadreId: versione_padre_id || null,
      cliente: clienteSelezionato,
      titolo: titoloScelto,
      pdfUrl,
      importoTotale: importo,
    })
  }

  async function salvaTemplate(tmpl: string) {
    setTemplate(tmpl)
    await salvaTemplatePreferito(tmpl)
  }

  return (
    <View style={styles.container}>
      <PreventivoPdfHeader onBack={() => router.back()} />

      <ScrollView style={styles.scroll} contentContainerStyle={{ padding: 16, gap: 14 }}>
        <PreventivoPdfPreviewCard htmlPreview={htmlPreview} caricandoPreview={caricandoPreview} />
        <PreventivoPdfTemplatePicker template={template} onSelectTemplate={salvaTemplate} />
        <View style={styles.opzioniDocumento}>
          <Text style={styles.opzioniDocumentoTitle}>Opzioni documento</Text>
          <PreventivoPdfTariffaToggle nascondiPrezzi={nascondiPrezzi} onChangeNascondiPrezzi={setNascondiPrezzi} />
          <PreventivoPdfAbbonamentoCard
            attivo={abbonamentoAttivo}
            importo={abImporto}
            giorno={abGiorno}
            meseInizio={abMeseInizio}
            mensilita={abMensilita}
            visibileNelPDF={abVisibileNelPDF}
            importoTotale={importo_totale}
            onChangeAttivo={onChangeAbbonamentoAttivo}
            onChangeImporto={setAbImporto}
            onChangeGiorno={setAbGiorno}
            onChangeMeseInizio={setAbMeseInizio}
            onChangeMensilita={setAbMensilita}
            onChangeVisibileNelPDF={setAbVisibileNelPDF}
          />
          <BuilderPagamentoRateCard
            attivo={pagamentoRateAttivo}
            numeroRate={rateNumero}
            giornoScadenza={rateGiornoScadenza}
            meseInizio={rateMeseInizio}
            visibileNelPDF={rateVisibileNelPDF}
            importoTotale={importoTotaleNum}
            onChangeAttivo={onChangePagamentoRateAttivo}
            onChangeNumeroRate={setRateNumero}
            onChangeGiornoScadenza={setRateGiornoScadenza}
            onChangeMeseInizio={setRateMeseInizio}
            onChangeVisibileNelPDF={setRateVisibileNelPDF}
          />
          <PagamentoCard
            metodiPagamento={metodiPagamento}
            metodoPagamentoSelezionato={metodoPagamentoSelezionato}
            metodoPagamentoNessuno={metodoPagamentoNessuno}
            onOpen={() => setMostraModalPagamento(true)}
            onConfigura={() => router.push('/screens/pagamenti')}
          />
        </View>
        <PreventivoPdfClienteButton
          cliente={clienteSelezionato}
          onPressCliente={() => setMostraModalCliente(true)}
        />
        <PreventivoPdfFooter
          versionePadreId={versione_padre_id}
          generando={generando}
          testoVuoto={!testo.trim()}
          onGenera={generaPDF}
        />
        <View style={{ height: 40 }} />
      </ScrollView>

      <MetodoPagamentoModal
        visible={mostraModalPagamento}
        metodiPagamento={metodiPagamento}
        metodoPagamentoSelezionato={metodoPagamentoSelezionato}
        metodoPagamentoNessuno={metodoPagamentoNessuno}
        stripeChargesEnabled={stripeChargesEnabled}
        onClose={() => setMostraModalPagamento(false)}
        onSelect={(metodo) => {
          setMetodoPagamentoSelezionato(metodo)
          setMetodoPagamentoNessuno(false)
        }}
        onSelectNessuno={() => {
          setMetodoPagamentoSelezionato(null)
          setMetodoPagamentoNessuno(true)
        }}
      />

      <PreventivoPdfClienteModal
        visible={mostraModalCliente}
        clienti={clienti}
        clienteSelezionato={clienteSelezionato}
        modalTab={modalTab}
        nuovoNomeCliente={nuovoNomeCliente}
        onClose={() => setMostraModalCliente(false)}
        onChangeTab={setModalTab}
        onChangeNuovoNome={setNuovoNomeCliente}
        onSelectCliente={setClienteSelezionato}
        onAggiungiCliente={aggiungiESelezionaCliente}
      />

      <PreventivoPdfSuccessModal
        visible={modalPdfSuccesso !== null}
        dettaglio={modalPdfSuccesso?.dettaglio}
        pdfUri={modalPdfSuccesso?.pdfUri}
        invio={modalPdfSuccesso?.invio}
        onClose={chiudiModalPdfSuccesso}
      />

      {mostraToastSalvato && (
        <View style={{
          position: 'absolute',
          bottom: 24 + insets.bottom,
          left: 24,
          right: 24,
          backgroundColor: '#0E9F8E',
          borderRadius: 12,
          paddingVertical: 12,
          paddingHorizontal: 16,
          alignItems: 'center',
          shadowColor: '#000',
          shadowOpacity: 0.12,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
          elevation: 6,
          zIndex: 100,
        }}>
          <Text style={{ color: '#fff', fontSize: 14, fontWeight: '600' }}>
            Preventivo salvato con successo
          </Text>
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F7F8FA' },
  scroll: { flex: 1 },
  opzioniDocumento: { gap: 14 },
  opzioniDocumentoTitle: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginLeft: 2,
  },
})
