# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: smoke.spec.ts >> public application smoke tests >> landing page renders without a fatal runtime error
- Location: tests\e2e\smoke.spec.ts:4:7

# Error details

```
Test timeout of 30000ms exceeded.
```

# Page snapshot

```yaml
- generic [ref=e17]:
  - generic [ref=e18]:
    - generic [ref=e19]: Bienvenue sur NousDeux
    - generic [ref=e20]: Connecte-toi pour lier ton compte à vie.
  - generic [ref=e21]:
    - checkbox "J'accepte les conditions générales et la politique de confidentialité de NousDeux." [ref=e22] [cursor=pointer]
    - generic [ref=e26]:
      - link "Conditions Générales" [ref=e27] [cursor=pointer]:
        - /url: /terms
      - generic [ref=e28]: ·
      - link "Politique de Confidentialité" [ref=e29] [cursor=pointer]:
        - /url: /privacy
    - generic [ref=e30]: Vos réponses sont chiffrées de bout en bout. Ni NousDeux ni ses serveurs ne peuvent les lire.
  - generic [ref=e31]: Continuer avec Google
```