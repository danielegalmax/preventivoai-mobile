import { useMemo, useState } from 'react'
import { ActivityIndicator, Alert, StyleSheet, Text, TouchableOpacity, View, type DimensionValue } from 'react-native'
import { LongPressAwarePressable } from '../LongPressAwarePressable'
import type { VoceMenuAzione } from '../MenuAzioniSheet'
import { mostraMenuAzioniAlert } from '../../utils/mostraMenuAzioniAlert'
import { MESI_BREVI } from '../../constants'
import { Abbonamento, PreventivoMadre, RataAbbonamento } from '../../types'
import { formatDataBreve, formatImportoEuro, giornoScadenzaEffettivo, labelScadenzaRataDaPiano, titoloHeaderPiano, analizzaStatoPiano, ordinaPianiPerStato } from 'previcloud-shared'
import { PianoStatoBadge } from './PianoStatoBadge'
import { PianoVuotoState } from './PianoVuotoState'
import { PreventivoMadreLink } from './PreventivoMadreLink'
import { pianoEspansoStyles } from './pianoEspansoStyles'
import { AppIcon } from '../icons/AppIcon'

type Props = {
  loading: boolean
  abbonamentiAttivi: Abbonamento[]
  ratePerPiano: Record<string, RataAbbonamento[]>
  preventiviMadreStorico: Record<string, PreventivoMadre>
  onApriPreventivoMadre?: (preventivoId: string) => void
  meseCorrente: number
  annoCorrente: number
  pianoEspansoId: string | null
  rataMiniAperta: string | null
  invioReminderLoading: string | null
  selezioneAttiva: boolean
  rateSelezionate: string[]
  onAvviaSelezione: (rataId: string) => void
  onToggleSelezione: (rataId: string) => void
  onToggleEspanso: (abbonamentoId: string) => void
  onRename: (abbonamentoId: string) => void
  onOpenAddRata: (abbonamentoId: string) => void
  onOpenPagamento: (rata: RataAbbonamento) => void
  onSendReminder: (rata: RataAbbonamento) => void
  onAzzeraPagamento: (rataId: string) => void
  onToggleRataMini: (rataId: string) => void
  onEditCanone: (abbonamentoId: string) => void
  onDeleteAbbonamento: (abbonamentoId: string) => void
  selezionePianoAttiva: boolean
  pianiSelezionati: string[]
  onAvviaSelezionePiano: (abbonamentoId: string) => void
  onToggleSelezionePiano: (abbonamentoId: string) => void
}

function badgeCanone(stato: RataAbbonamento['stato']) {
  if (stato === 'incassato') return { label: 'Incassato', bg: '#D1FAE5', color: '#0B7A6D' }
  if (stato === 'in_ritardo') return { label: 'In ritardo', bg: '#FEE2E2', color: '#EF4444' }
  if (stato === 'parziale') return { label: 'Parziale', bg: '#FEF3C7', color: '#D97706' }
  return { label: 'Da incassare', bg: '#F3F4F6', color: '#6B7280' }
}

function ordinaRateCronologica(a: RataAbbonamento, b: RataAbbonamento) {
  return a.anno - b.anno || a.mese - b.mese
}

function percentWidth(value: number): DimensionValue {
  return `${Math.max(0, Math.min(100, value))}%`
}

function residuoRata(rata: RataAbbonamento) {
  return rata.importo - (rata.acconto || 0)
}

function totaleIncassatoPiano(rate: RataAbbonamento[]) {
  return rate
    .filter(r => r.stato === 'incassato')
    .reduce((a, r) => a + r.importo, 0)
}

type RataDetailProps = {
  rata: RataAbbonamento
  invioReminderLoading: string | null
  onOpenPagamento: (rata: RataAbbonamento) => void
  onSendReminder: (rata: RataAbbonamento) => void
  onAzzeraPagamento: (rataId: string) => void
}

function RataDetail({
  rata,
  invioReminderLoading,
  onOpenPagamento,
  onSendReminder,
  onAzzeraPagamento,
}: RataDetailProps) {
  return (
    <>
      {rata.stato === 'parziale' && (
        <View style={styles.rataBarraContainer}>
          <View style={styles.rataBarra}>
            <View style={[styles.rataBarraFill, { width: percentWidth(((rata.acconto || 0) / rata.importo) * 100) }]} />
          </View>
          <View style={styles.rataBarraLabels}>
            <Text style={styles.rataBarraAcconto}>Acconto: {'\u20AC'}{formatImportoEuro(rata.acconto || 0, 2)}</Text>
            <Text style={styles.rataBarraResiduo}>Residuo: {'\u20AC'}{formatImportoEuro(residuoRata(rata), 2)}</Text>
          </View>
        </View>
      )}
      {rata.data_incasso ? (
        <Text style={styles.rataDataIncasso}>Pagato il {formatDataBreve(rata.data_incasso)}</Text>
      ) : null}
      {rata.note ? <Text style={styles.rataNota}>{rata.note}</Text> : null}
      <View style={styles.rataAzioni}>
        {rata.stato !== 'incassato' && (
          <TouchableOpacity style={styles.rataAzioneBtn} onPress={() => onOpenPagamento(rata)}>
            <Text style={styles.rataAzioneBtnText}>+ Registra pagamento</Text>
          </TouchableOpacity>
        )}
        {rata.stato !== 'incassato' && (
          <TouchableOpacity
            style={[styles.rataAzioneBtn, styles.reminderBtnCompact]}
            onPress={() => onSendReminder(rata)}
            disabled={invioReminderLoading === rata.id}
          >
            {invioReminderLoading === rata.id
              ? <ActivityIndicator size="small" color="#25D366" />
              : (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <AppIcon name="send" size={14} color="#25D366" />
                  <Text style={styles.reminderBtnCompactText}>WA</Text>
                </View>
              )}
          </TouchableOpacity>
        )}
        {rata.stato === 'incassato' && (
          <TouchableOpacity
            style={[styles.rataAzioneBtn, { borderColor: '#E5E7EB' }]}
            onPress={() => Alert.alert('Azzera', 'Riportare a "da incassare"?', [
              { text: 'Annulla', style: 'cancel' },
              { text: 'Azzera', style: 'destructive', onPress: () => onAzzeraPagamento(rata.id) },
            ])}
          >
            <Text style={[styles.rataAzioneBtnText, { color: '#9CA3AF' }]}>{'\u21A9'} Azzera</Text>
          </TouchableOpacity>
        )}
      </View>
    </>
  )
}

type RataStoricoProps = {
  rata: RataAbbonamento
  giornoScadenzaPiano: number
  aperta: boolean
  selezioneAttiva: boolean
  selezionePianoAttiva: boolean
  selezionata: boolean
  invioReminderLoading: string | null
  onPress: () => void
  onLongPress: () => void
  onOpenPagamento: (rata: RataAbbonamento) => void
  onSendReminder: (rata: RataAbbonamento) => void
  onAzzeraPagamento: (rataId: string) => void
}

function RataStoricoRow({
  rata,
  giornoScadenzaPiano,
  aperta,
  selezioneAttiva,
  selezionePianoAttiva,
  selezionata,
  invioReminderLoading,
  onPress,
  onLongPress,
  onOpenPagamento,
  onSendReminder,
  onAzzeraPagamento,
}: RataStoricoProps) {
  const badge = badgeCanone(rata.stato)
  return (
    <LongPressAwarePressable
      style={[styles.rataMiniTab, selezioneAttiva && selezionata && styles.rataMiniTabSelected]}
      onPress={() => {
        if (selezionePianoAttiva) return
        onPress()
      }}
      onLongPress={() => {
        if (selezionePianoAttiva) return
        onLongPress()
      }}
    >
      <View style={styles.rataMiniRow}>
        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={styles.rataMiniMese}>{labelScadenzaRataDaPiano(rata, giornoScadenzaPiano)}</Text>
          {selezioneAttiva && selezionata ? <Text style={styles.rataCheck}>{'\u2713'}</Text> : null}
        </View>
        <Text style={styles.rataMiniImporto}>{`\u20AC${formatImportoEuro(rata.importo, 2)}`}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Text style={[styles.badgeText, { color: badge.color }]}>{badge.label}</Text>
        </View>
        {!selezioneAttiva ? (
          <Text style={styles.sectionArrow}>{aperta ? '\u25B2' : '\u25BC'}</Text>
        ) : null}
      </View>
      {!selezionePianoAttiva && !selezioneAttiva && aperta ? (
        <View style={styles.rataMiniDetail}>
          <RataDetail
            rata={rata}
            invioReminderLoading={invioReminderLoading}
            onOpenPagamento={onOpenPagamento}
            onSendReminder={onSendReminder}
            onAzzeraPagamento={onAzzeraPagamento}
          />
        </View>
      ) : null}
    </LongPressAwarePressable>
  )
}

type AbbonamentoPianoCardProps = {
  abbonamento: Abbonamento
  indice: number
  preventivoMadre: PreventivoMadre | null
  rate: RataAbbonamento[]
  espanso: boolean
  meseCorrente: number
  annoCorrente: number
  rataMiniAperta: string | null
  invioReminderLoading: string | null
  selezioneAttiva: boolean
  rateSelezionate: string[]
  onApriPreventivoMadre?: (preventivoId: string) => void
  onAvviaSelezione: (rataId: string) => void
  onToggleSelezione: (rataId: string) => void
  onToggleEspanso: () => void
  onRename: () => void
  onOpenAddRata: () => void
  onOpenPagamento: (rata: RataAbbonamento) => void
  onSendReminder: (rata: RataAbbonamento) => void
  onAzzeraPagamento: (rataId: string) => void
  onToggleRataMini: (rataId: string) => void
  onEditCanone: () => void
  onDeleteAbbonamento: () => void
  selezionePianoAttiva: boolean
  pianoSelezionato: boolean
  onAvviaSelezionePiano: () => void
  onToggleSelezionePiano: () => void
}

function AbbonamentoPianoCard({
  abbonamento,
  indice,
  preventivoMadre,
  rate,
  espanso,
  meseCorrente,
  annoCorrente,
  rataMiniAperta,
  invioReminderLoading,
  selezioneAttiva,
  rateSelezionate,
  onApriPreventivoMadre,
  onAvviaSelezione,
  onToggleSelezione,
  onToggleEspanso,
  onRename,
  onOpenAddRata,
  onOpenPagamento,
  onSendReminder,
  onAzzeraPagamento,
  onToggleRataMini,
  onEditCanone,
  onDeleteAbbonamento,
  selezionePianoAttiva,
  pianoSelezionato,
  onAvviaSelezionePiano,
  onToggleSelezionePiano,
}: AbbonamentoPianoCardProps) {
  const [storicoAperto, setStoricoAperto] = useState(false)

  function vociMenu(): VoceMenuAzione[] {
    return [
      { label: 'Rinomina', onPress: onRename },
      { label: 'Modifica canone', onPress: onEditCanone },
      {
        label: 'Elimina',
        onPress: () => {
          Alert.alert('Elimina abbonamento', 'Le rate storiche resteranno salvate. Vuoi procedere?', [
            { text: 'Annulla', style: 'cancel' },
            { text: 'Elimina', style: 'destructive', onPress: onDeleteAbbonamento },
          ])
        },
        danger: true,
      },
    ]
  }

  const rataMeseCorrente = rate.find(r => r.mese === meseCorrente && r.anno === annoCorrente)
  const rateStoriche = rate.filter(r => !(r.mese === meseCorrente && r.anno === annoCorrente))
  const rateStoricheOrdinate = useMemo(
    () => [...rateStoriche].sort(ordinaRateCronologica),
    [rateStoriche],
  )
  const totaleIncassato = totaleIncassatoPiano(rate)
  const analisi = useMemo(() => analizzaStatoPiano(abbonamento, rate), [abbonamento, rate])
  const giornoScadenzaPiano = giornoScadenzaEffettivo(abbonamento.giorno_scadenza)
  const prossima = useMemo(
    () => [...rate].sort((a, b) => a.anno - b.anno || a.mese - b.mese).find(r => r.stato !== 'incassato'),
    [rate],
  )
  const sottotitoloRiepilogo = useMemo(() => {
    if (analisi.concluso || analisi.stato === 'vuoto' || analisi.stato === 'in_ritardo' || analisi.stato === 'in_regola') {
      return analisi.sottotitolo
    }
    if (!prossima) return analisi.sottotitolo
    return `Prossima: ${labelScadenzaRataDaPiano(prossima, giornoScadenzaPiano)} \u00B7 \u20AC${formatImportoEuro(prossima.importo, 2)}`
  }, [analisi, prossima, giornoScadenzaPiano])
  const badgeCorrente = rataMeseCorrente ? badgeCanone(rataMeseCorrente.stato) : null
  const defaultNome = `Abbonamento N.${indice + 1}`
  const cardEspansa = espanso && !selezionePianoAttiva

  return (
    <View style={[
      styles.pianoCard,
      pianoEspansoStyles.card,
      cardEspansa && pianoEspansoStyles.cardEspansa,
      pianoSelezionato && styles.pianoHeaderSelected,
      analisi.concluso && styles.pianoHeaderConcluso,
    ]}>
      <LongPressAwarePressable
        style={[
          styles.abHeader,
          cardEspansa && styles.abHeaderEspanso,
        ]}
        onPress={() => {
          if (selezionePianoAttiva) {
            onToggleSelezionePiano()
            return
          }
          onToggleEspanso()
        }}
        onLongPress={() => onAvviaSelezionePiano()}
      >
        {selezionePianoAttiva ? (
          <View style={[styles.checkCircle, pianoSelezionato && styles.checkCircleActive]}>
            {pianoSelezionato ? <Text style={styles.checkMark}>{'\u2713'}</Text> : null}
          </View>
        ) : null}
        <View style={styles.abHeaderTesto}>
          <View style={styles.pianoHeaderTitleRow}>
            <Text style={styles.abHeaderNome} numberOfLines={1} ellipsizeMode="tail">
              {titoloHeaderPiano(abbonamento.nome, preventivoMadre, 'canone', defaultNome)}
            </Text>
            {!selezionePianoAttiva ? <PianoStatoBadge analisi={analisi} compact /> : null}
          </View>
          <Text style={styles.abHeaderSub}>
            {analisi.concluso
              ? `Canone completato \u00B7 \u20AC${formatImportoEuro(totaleIncassato, 2)} incassati`
              : `Canone mensile \u00B7 \u20AC${formatImportoEuro(abbonamento.importo_default, 2)}/mese \u00B7 giorno ${abbonamento.giorno_scadenza}`}
          </Text>
          {sottotitoloRiepilogo ? (
            <Text style={[styles.abHeaderHint, analisi.concluso && styles.abHeaderHintConcluso]}>
              {sottotitoloRiepilogo}
            </Text>
          ) : totaleIncassato > 0 && !analisi.concluso ? (
            <Text style={styles.abHeaderHint}>
              {`\u20AC${formatImportoEuro(totaleIncassato, 2)} incassati`}
            </Text>
          ) : null}
        </View>
        {!selezionePianoAttiva ? (
          <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <TouchableOpacity
              hitSlop={8}
              onPress={() => mostraMenuAzioniAlert(
                vociMenu(),
                titoloHeaderPiano(abbonamento.nome, preventivoMadre, 'canone', defaultNome),
              )}
            >
              <Text style={styles.menuPuntini}>{'\u22EE'}</Text>
            </TouchableOpacity>
            <Text style={styles.abHeaderArrow}>{espanso ? '\u25B2' : '\u25BC'}</Text>
          </View>
        ) : null}
      </LongPressAwarePressable>

      {cardEspansa ? (
        <View style={pianoEspansoStyles.body}>
          <PreventivoMadreLink preventivo={preventivoMadre} onPress={onApriPreventivoMadre} />

          {rataMeseCorrente ? (
            <LongPressAwarePressable
              style={[
                styles.rataCardCorrente,
                !selezionePianoAttiva && selezioneAttiva && rateSelezionate.includes(rataMeseCorrente.id) && styles.rataCardSelected,
              ]}
              onPress={() => {
                if (selezionePianoAttiva) return
                if (selezioneAttiva) onToggleSelezione(rataMeseCorrente.id)
              }}
              onLongPress={() => {
                if (selezionePianoAttiva) return
                onAvviaSelezione(rataMeseCorrente.id)
              }}
            >
              <View style={styles.rataRow}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <Text style={styles.rataMese}>
                      {labelScadenzaRataDaPiano(rataMeseCorrente, giornoScadenzaPiano)}
                    </Text>
                    <Text style={styles.rataMeseTag}>corrente</Text>
                    {selezioneAttiva && rateSelezionate.includes(rataMeseCorrente.id) ? (
                      <Text style={styles.rataCheck}>{'\u2713'}</Text>
                    ) : null}
                  </View>
                  {rataMeseCorrente.note ? <Text style={styles.rataNota}>{rataMeseCorrente.note}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 6 }}>
                  <Text style={styles.rataImporto}>
                    {`\u20AC${formatImportoEuro(rataMeseCorrente.importo, 2)}`}
                  </Text>
                  {badgeCorrente ? (
                    <View style={[styles.badge, { backgroundColor: badgeCorrente.bg }]}>
                      <Text style={[styles.badgeText, { color: badgeCorrente.color }]}>{badgeCorrente.label}</Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {!selezionePianoAttiva && !selezioneAttiva ? (
                <RataDetail
                  rata={rataMeseCorrente}
                  invioReminderLoading={invioReminderLoading}
                  onOpenPagamento={onOpenPagamento}
                  onSendReminder={onSendReminder}
                  onAzzeraPagamento={onAzzeraPagamento}
                />
              ) : null}
            </LongPressAwarePressable>
          ) : (
            <TouchableOpacity style={styles.abGeneraBtn} onPress={onOpenAddRata}>
              <Text style={styles.abGeneraBtnText}>
                {`+ Aggiungi canone ${MESI_BREVI[meseCorrente - 1]} ${annoCorrente}`}
              </Text>
            </TouchableOpacity>
          )}

          {rateStoricheOrdinate.length > 0 ? (
            <View style={styles.section}>
              <TouchableOpacity style={styles.sectionHeader} onPress={() => setStoricoAperto(v => !v)}>
                <Text style={styles.sectionTitle}>{`Storico canoni (${rateStoricheOrdinate.length})`}</Text>
                <Text style={styles.sectionArrow}>{storicoAperto ? '\u25B2' : '\u25BC'}</Text>
              </TouchableOpacity>
              {storicoAperto ? rateStoricheOrdinate.map(rata => (
                <RataStoricoRow
                  key={rata.id}
                  rata={rata}
                  giornoScadenzaPiano={giornoScadenzaPiano}
                  aperta={rataMiniAperta === rata.id}
                  selezioneAttiva={selezioneAttiva}
                  selezionePianoAttiva={selezionePianoAttiva}
                  selezionata={rateSelezionate.includes(rata.id)}
                  invioReminderLoading={invioReminderLoading}
                  onPress={() => {
                    if (selezionePianoAttiva) return
                    if (selezioneAttiva) onToggleSelezione(rata.id)
                    else onToggleRataMini(rata.id)
                  }}
                  onLongPress={() => {
                    if (selezionePianoAttiva) return
                    onAvviaSelezione(rata.id)
                  }}
                  onOpenPagamento={onOpenPagamento}
                  onSendReminder={onSendReminder}
                  onAzzeraPagamento={onAzzeraPagamento}
                />
              )) : null}
            </View>
          ) : null}

          {!selezioneAttiva && !selezionePianoAttiva ? (
            <TouchableOpacity style={styles.abAggiungiBtn} onPress={onOpenAddRata}>
              <Text style={styles.abAggiungiText}>+ Aggiungi canone (mese/anno)</Text>
            </TouchableOpacity>
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

export function ClienteAbbonamentoTab({
  loading,
  abbonamentiAttivi,
  ratePerPiano,
  preventiviMadreStorico,
  onApriPreventivoMadre,
  meseCorrente,
  annoCorrente,
  pianoEspansoId,
  rataMiniAperta,
  invioReminderLoading,
  selezioneAttiva,
  rateSelezionate,
  onAvviaSelezione,
  onToggleSelezione,
  onToggleEspanso,
  onRename,
  onOpenAddRata,
  onOpenPagamento,
  onSendReminder,
  onAzzeraPagamento,
  onToggleRataMini,
  onEditCanone,
  onDeleteAbbonamento,
  selezionePianoAttiva,
  pianiSelezionati,
  onAvviaSelezionePiano,
  onToggleSelezionePiano,
}: Props) {
  const pianiOrdinati = useMemo(
    () => ordinaPianiPerStato(abbonamentiAttivi, ratePerPiano, id => abbonamentiAttivi.find(a => a.id === id)),
    [abbonamentiAttivi, ratePerPiano],
  )

  const pianiAttivi = useMemo(
    () => pianiOrdinati.filter(a => !analizzaStatoPiano(a, ratePerPiano[a.id] || []).concluso),
    [pianiOrdinati, ratePerPiano],
  )
  const pianiConclusi = useMemo(
    () => pianiOrdinati.filter(a => analizzaStatoPiano(a, ratePerPiano[a.id] || []).concluso),
    [pianiOrdinati, ratePerPiano],
  )

  if (loading) return <ActivityIndicator color="#0E9F8E" style={{ marginTop: 40 }} />

  if (abbonamentiAttivi.length === 0) {
    return (
      <PianoVuotoState
        icon="repeat"
        title="Nessun abbonamento"
        description="Configura un canone mensile ricorrente per questo cliente: importo fisso, scadenza e rate mensili automatiche."
      />
    )
  }

  function renderPianoCard(abbonamento: Abbonamento, indice: number) {
    const rate = ratePerPiano[abbonamento.id] || []
    const preventivoMadre = abbonamento.preventivo_id
      ? preventiviMadreStorico[abbonamento.preventivo_id] ?? null
      : null
    const espanso = pianoEspansoId === abbonamento.id
      || (pianoEspansoId === null && indice === 0 && pianiAttivi[0]?.id === abbonamento.id)

    return (
      <AbbonamentoPianoCard
        key={abbonamento.id}
        abbonamento={abbonamento}
        indice={indice}
        preventivoMadre={preventivoMadre}
        rate={rate}
        espanso={espanso}
        meseCorrente={meseCorrente}
        annoCorrente={annoCorrente}
        rataMiniAperta={rataMiniAperta}
        invioReminderLoading={invioReminderLoading}
        selezioneAttiva={selezioneAttiva}
        rateSelezionate={rateSelezionate}
        onApriPreventivoMadre={onApriPreventivoMadre}
        onAvviaSelezione={onAvviaSelezione}
        onToggleSelezione={onToggleSelezione}
        onToggleEspanso={() => onToggleEspanso(abbonamento.id)}
        onRename={() => onRename(abbonamento.id)}
        onOpenAddRata={() => onOpenAddRata(abbonamento.id)}
        onOpenPagamento={onOpenPagamento}
        onSendReminder={onSendReminder}
        onAzzeraPagamento={onAzzeraPagamento}
        onToggleRataMini={onToggleRataMini}
        onEditCanone={() => onEditCanone(abbonamento.id)}
        onDeleteAbbonamento={() => onDeleteAbbonamento(abbonamento.id)}
        selezionePianoAttiva={selezionePianoAttiva}
        pianoSelezionato={pianiSelezionati.includes(abbonamento.id)}
        onAvviaSelezionePiano={() => onAvviaSelezionePiano(abbonamento.id)}
        onToggleSelezionePiano={() => onToggleSelezionePiano(abbonamento.id)}
      />
    )
  }

  return (
    <View style={styles.container}>
      {pianiAttivi.map((abbonamento, indice) => renderPianoCard(abbonamento, indice))}
      {pianiConclusi.length > 0 ? (
        <>
          <Text style={styles.sezioneConclusiLabel}>
            {pianiConclusi.length === 1 ? 'Concluso' : `Conclusi (${pianiConclusi.length})`}
          </Text>
          {pianiConclusi.map((abbonamento, indice) => renderPianoCard(abbonamento, pianiAttivi.length + indice))}
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 12 },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  checkCircleActive: { backgroundColor: '#0E9F8E', borderColor: '#0E9F8E' },
  checkMark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  pianoCard: { gap: 0 },
  abHeader: { padding: 16, flexDirection: 'row', alignItems: 'center' },
  abHeaderEspanso: { paddingBottom: 12 },
  pianoHeaderSelected: { backgroundColor: '#F0FDF4' },
  pianoHeaderConcluso: { backgroundColor: '#F0FDF4' },
  pianoHeaderTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  abHeaderTesto: { flex: 1, minWidth: 0 },
  abHeaderNome: { fontSize: 15, fontWeight: '700', color: '#0D1B2A', flexShrink: 1 },
  abHeaderSub: { fontSize: 12, color: '#6B7280', marginTop: 4 },
  abHeaderHint: { fontSize: 12, color: '#0B7A6D', marginTop: 4, fontWeight: '500' },
  abHeaderHintConcluso: { color: '#047857' },
  sezioneConclusiLabel: {
    fontSize: 11,
    fontWeight: '600',
    color: '#9CA3AF',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginTop: 8,
    marginBottom: -4,
  },
  abHeaderArrow: { fontSize: 12, color: '#9CA3AF' },
  menuPuntini: { fontSize: 22, color: '#9CA3AF', lineHeight: 24 },
  rataCardCorrente: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1.5, borderColor: '#0E9F8E', padding: 14, gap: 10, shadowColor: '#0D1B2A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 1 },
  rataCardSelected: { backgroundColor: '#F0FDF4' },
  rataRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  rataMese: { fontSize: 14, fontWeight: '600', color: '#0D1B2A' },
  rataMeseTag: { fontSize: 10, fontWeight: '600', color: '#0B7A6D', backgroundColor: '#F0FDF4', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  rataImporto: { fontSize: 15, fontWeight: '700', color: '#0D1B2A' },
  abGeneraBtn: { backgroundColor: '#F7F8FA', borderRadius: 10, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#E5E7EB' },
  abGeneraBtnText: { fontSize: 13, color: '#0B7A6D', fontWeight: '500' },
  section: { backgroundColor: '#fff', borderRadius: 14, borderWidth: 1, borderColor: '#E5E7EB', overflow: 'hidden', shadowColor: '#0D1B2A', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 4, elevation: 1 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 14, paddingVertical: 12, backgroundColor: '#F7F8FA' },
  sectionTitle: { fontSize: 12, fontWeight: '600', color: '#6B7280', letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionArrow: { fontSize: 10, color: '#9CA3AF' },
  rataMiniTab: { borderTopWidth: 1, borderTopColor: '#F3F4F6', padding: 12 },
  rataMiniTabSelected: { backgroundColor: '#F0FDF4' },
  rataMiniRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rataMiniMese: { fontSize: 13, fontWeight: '500', color: '#0D1B2A' },
  rataMiniImporto: { fontSize: 13, fontWeight: '600', color: '#0D1B2A' },
  rataMiniDetail: { marginTop: 10, gap: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { fontSize: 10, fontWeight: '600' },
  rataCheck: { fontSize: 14, fontWeight: '700', color: '#0B7A6D' },
  abAggiungiBtn: { alignItems: 'center', padding: 12 },
  abAggiungiText: { fontSize: 13, color: '#0B7A6D', fontWeight: '500' },
  rataNota: { fontSize: 12, color: '#9CA3AF', marginTop: 2 },
  rataDataIncasso: { fontSize: 12, color: '#9CA3AF' },
  rataBarraContainer: { gap: 4 },
  rataBarra: { height: 6, backgroundColor: '#F3F4F6', borderRadius: 3, overflow: 'hidden' },
  rataBarraFill: { height: 6, backgroundColor: '#F59E0B', borderRadius: 3 },
  rataBarraLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  rataBarraAcconto: { fontSize: 11, color: '#F59E0B', fontWeight: '500' },
  rataBarraResiduo: { fontSize: 11, color: '#EF4444', fontWeight: '500' },
  rataAzioni: { flexDirection: 'row', gap: 8 },
  rataAzioneBtn: { flex: 1, borderRadius: 10, padding: 9, alignItems: 'center', borderWidth: 1, borderColor: '#0E9F8E' },
  rataAzioneBtnText: { fontSize: 13, color: '#0B7A6D', fontWeight: '600' },
  reminderBtnCompact: { flex: 0, paddingHorizontal: 12, borderColor: '#25D366' },
  reminderBtnCompactText: { fontSize: 13, color: '#25D366', fontWeight: '600' },
})
