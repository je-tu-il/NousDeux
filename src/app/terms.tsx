import React from 'react';
import { StyleSheet, View, Text, ScrollView, Pressable, Platform, ImageBackground } from 'react-native';
import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';

const styles = StyleSheet.create({
  container: { flex: 1, width: '100%', backgroundColor: '#FFF5F2' },
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

export default function TermsScreen() {
  return (
    <ImageBackground
      source={require('../../assets/images/settings_bg.png')}
      style={styles.container}
      resizeMode="cover"
    >
      <ScrollView style={styles.scroll} contentContainerStyle={{ paddingBottom: 60 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable style={styles.backBtn} onPress={() => router.back()}>
            <ArrowLeft color="#4A3B39" size={24} />
          </Pressable>
          <Text style={styles.pageTitle}>Conditions Générales d'Utilisation</Text>
          <View style={{ width: 44 }} />
        </View>

        <Animated.View entering={FadeInUp.duration(500)} style={styles.card}>
          <Text style={styles.lastUpdated}>Dernière mise à jour : 6 août 2026</Text>

          <Section title="1. Présentation">
            NousDeux est une application mobile et web (ci-après «&nbsp;l'Application&nbsp;») permettant à deux partenaires de se poser et répondre mutuellement à des questions quotidiennes dans le but de renforcer leur relation.{'\n\n'}
            En utilisant NousDeux, vous acceptez les présentes Conditions Générales d'Utilisation (CGU) dans leur intégralité.
          </Section>

          <Section title="2. Accès et inscription">
            L'accès à l'Application nécessite une connexion via un compte Google. En vous connectant, vous garantissez que les informations fournies sont exactes.{'\n\n'}
            L'Application est destinée aux personnes âgées d'au moins <B>16 ans</B>. Toute personne de moins de 16 ans est invitée à ne pas utiliser le service.
          </Section>

          <Section title="3. Fonctionnement du service">
            NousDeux permet à deux utilisateurs de lier leurs comptes via un code de synchronisation. Une fois liés, ils partagent :{'\n\n'}
            • Une question commune par jour{'\n'}
            • Un accès à des questions illimitées par catégorie{'\n'}
            • Un calendrier de leur série de jours actifs{'\n\n'}
            Les réponses sont chiffrées de bout en bout et ne sont visibles que par les deux partenaires.
          </Section>

          <Section title="4. Obligations de l'utilisateur">
            En utilisant NousDeux, vous vous engagez à :{'\n\n'}
            • Ne pas utiliser l'Application à des fins illicites ou contraires aux bonnes mœurs{'\n'}
            • Ne pas tenter de contourner les mécanismes de sécurité{'\n'}
            • Ne pas usurper l'identité d'une autre personne{'\n'}
            • Ne pas partager votre code de synchronisation avec une personne autre que votre partenaire souhaité{'\n\n'}
            Tout manquement pourra entraîner la suppression du compte sans préavis.
          </Section>

          <Section title="5. Propriété intellectuelle">
            L'Application, son interface et son contenu (questions, design, code) sont la propriété exclusive de NousDeux. Toute reproduction ou utilisation sans autorisation est interdite.{'\n\n'}
            Les contenus générés par les utilisateurs (réponses aux questions) restent leur propriété. NousDeux n'y a pas accès grâce au chiffrement de bout en bout.
          </Section>

          <Section title="6. Disponibilité et modifications">
            NousDeux est fourni «&nbsp;en l'état&nbsp;» et «&nbsp;tel que disponible&nbsp;». Aucune garantie de disponibilité continue n'est offerte.{'\n\n'}
            NousDeux se réserve le droit de modifier, suspendre ou arrêter le service à tout moment, sans préavis.
          </Section>

          <Section title="7. Limitation de responsabilité">
            NousDeux ne saurait être tenu responsable :{'\n\n'}
            • Des dommages résultant d'une interruption du service{'\n'}
            • De la perte de données liée à une suppression de compte{'\n'}
            • Des conséquences de l'utilisation de l'Application sur votre vie personnelle ou relationnelle
          </Section>

          <Section title="8. Suppression du compte">
            Vous pouvez supprimer votre compte à tout moment depuis Paramètres → Zone Danger → Supprimer le compte. La suppression est définitive et entraîne l'effacement de toutes vos données personnelles.
          </Section>

          <Section title="9. Droit applicable">
            Les présentes CGU sont soumises au droit français. Tout litige sera porté devant les juridictions compétentes françaises.
          </Section>

          <Section title="10. Contact">
            Pour toute question relative aux présentes CGU : <B>nousdeux.app.contact@gmail.com</B>
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
