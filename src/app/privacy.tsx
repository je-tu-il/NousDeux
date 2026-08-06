import React from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

export default function PrivacyScreen() {
  return (
    <ImageBackground
      source={require('../../assets/images/bloomy_warm_background.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft color="#4A3B39" size={24} />
          </Pressable>
          <Text style={styles.pageTitle}>Politique de Confidentialité</Text>
          <View style={{ width: 44 }} />
        </View>

        <Animated.View entering={FadeInUp.duration(500)} style={styles.card}>
          <Text style={styles.lastUpdated}>Dernière mise à jour : 6 août 2026</Text>

          <Section title="1. Qui sommes-nous ?">
            Bloomy est une application permettant à deux partenaires de répondre ensemble à des questions quotidiennes.{'\n\n'}
            Responsable du traitement : Bloomy (projet personnel).{'\n'}
            Contact : bloomy.app.contact@gmail.com
          </Section>

          <Section title="2. Données collectées">
            Dans le cadre du fonctionnement de l'application, nous collectons :{'\n\n'}
            • <B>Données d'identification Google</B> : adresse e-mail, UID Firebase (fourni automatiquement lors de la connexion via Google).{'\n\n'}
            • <B>Profil utilisateur</B> : pseudo choisi, âge, photo de profil (optionnelle, encodée en base64 et stockée dans Firebase).{'\n\n'}
            • <B>Données de couple</B> : date d'anniversaire du couple, identifiant du couple (anonyme), code de synchronisation.{'\n\n'}
            • <B>Réponses aux questions</B> : vos réponses sont <B>chiffrées de bout en bout</B> (AES-256-GCM) avant d'être envoyées sur nos serveurs. Ni Bloomy, ni Firebase, ni aucun administrateur ne peut les lire.{'\n\n'}
            • <B>Données de progression</B> : index de question atteint, identifiants de questions vues.
          </Section>

          <Section title="3. Finalité du traitement">
            Les données sont utilisées exclusivement pour :{'\n\n'}
            • Permettre la synchronisation entre partenaires{'\n'}
            • Afficher votre profil et celui de votre partenaire{'\n'}
            • Gérer la progression dans les questions{'\n'}
            • Calculer la série de jours consécutifs (streak)
          </Section>

          <Section title="4. Hébergement & transfert hors UE">
            Vos données sont hébergées sur <B>Firebase (Google LLC)</B>, dont les serveurs sont situés aux États-Unis. Google LLC est certifié dans le cadre du mécanisme de transfert UE–États-Unis (Data Privacy Framework) et offre des garanties adéquates au sens du RGPD.{'\n\n'}
            En utilisant Bloomy, vous acceptez ce transfert.
          </Section>

          <Section title="5. Durée de conservation">
            Vos données sont conservées tant que votre compte est actif.{'\n\n'}
            En cas de suppression de compte via Paramètres → Zone Danger → Supprimer le compte, toutes vos données personnelles et vos réponses sont supprimées définitivement dans un délai de 30 jours.
          </Section>

          <Section title="6. Vos droits (RGPD)">
            Vous disposez des droits suivants :{'\n\n'}
            • <B>Droit d'accès</B> : vous pouvez consulter vos données dans l'application (profil, réponses).{'\n\n'}
            • <B>Droit de rectification</B> : vous pouvez modifier vos données dans Paramètres.{'\n\n'}
            • <B>Droit à l'effacement</B> : vous pouvez supprimer votre compte et toutes vos données via Paramètres → Zone Danger.{'\n\n'}
            • <B>Droit à la portabilité</B> : contactez-nous à l'adresse ci-dessus.{'\n\n'}
            • <B>Droit d'opposition</B> : vous pouvez cesser d'utiliser l'application à tout moment.{'\n\n'}
            Pour exercer vos droits, contactez : <B>bloomy.app.contact@gmail.com</B>
          </Section>

          <Section title="7. Sécurité">
            Vos réponses aux questions sont protégées par un chiffrement <B>AES-256-GCM de bout en bout</B>. La clé de chiffrement est dérivée localement sur votre appareil et n'est jamais transmise à nos serveurs. Seuls vous et votre partenaire pouvez déchiffrer vos réponses.{'\n\n'}
            La communication avec Firebase est sécurisée via TLS/HTTPS.
          </Section>

          <Section title="8. Mineurs">
            Bloomy est destinée aux personnes âgées d'au moins 16 ans. Si vous avez connaissance qu'un mineur de moins de 16 ans utilise l'application, veuillez nous contacter.
          </Section>

          <Section title="9. Modifications">
            Cette politique peut être mise à jour. En cas de modification substantielle, nous vous en informerons lors de votre prochaine connexion.
          </Section>

          <Section title="10. Contact & réclamation">
            Pour toute question : <B>bloomy.app.contact@gmail.com</B>{'\n\n'}
            Vous avez également le droit d'introduire une réclamation auprès de la <B>CNIL</B> (Commission Nationale de l'Informatique et des Libertés) : www.cnil.fr
          </Section>
        </Animated.View>
      </ScrollView>
    </ImageBackground>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Text style={styles.sectionBody}>{children}</Text>
    </View>
  );
}

function B({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontWeight: '700' }}>{children}</Text>;
}

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%' },
  scroll: { flex: 1, padding: 20, paddingTop: Platform.OS === 'web' ? 20 : 50, width: '100%', maxWidth: 600, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 },
  backBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' },
  pageTitle: { fontSize: 18, fontWeight: '800', color: '#4A3B39', flex: 1, textAlign: 'center' },
  lastUpdated: { fontSize: 12, color: '#A99693', marginBottom: 20, fontStyle: 'italic' },
  card: { backgroundColor: 'rgba(255,255,255,0.88)', borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 5 }, shadowOpacity: 0.08, shadowRadius: 15, elevation: 5 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 15, fontWeight: '800', color: '#4A3B39', marginBottom: 8 },
  sectionBody: { fontSize: 14, color: '#5a4a48', lineHeight: 22 },
});
