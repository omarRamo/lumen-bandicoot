// Lumen Bandicoot — cinematics script (FR/EN). Pure data. Each panel = { scene, speaker, text }.
// speaker ∈ narrator | lumen | zina | oku | cortisol ; scene = key of a painter in story.js.

export const STORIES = {
  intro: [
    { scene: 'picnic', speaker: 'narrator', text: {
      fr: 'Il était une fois, sur l\'Île des Lucioles, un petit renard nommé Lumen. Pas un bandicoot. Un renard. Merci de noter.',
      en: 'Once upon a time, on Firefly Island, lived a little fox called Lumen. Not a bandicoot. A fox. Please take notes.' } },
    { scene: 'picnic', speaker: 'zina', text: {
      fr: 'Lumen, tu as encore mis du sable dans les sandwichs.',
      en: 'Lumen, you put sand in the sandwiches again.' } },
    { scene: 'cortisol_arrives', speaker: 'cortisol', text: {
      fr: 'MOUAHAHA ! Je suis le Docteur Néo Cortisol ! Avec mon Stressotron, le monde entier sera… STRESSÉ ! Comme moi !',
      en: 'MWAHAHA! I am Doctor Neo Cortisol! With my Stressotron, the whole world will be… STRESSED! Just like me!' } },
    { scene: 'kidnap', speaker: 'zina', text: {
      fr: 'LUMEN ! Il a pris le panier de pique-nique… ET MOI !',
      en: 'LUMEN! He took the picnic basket… AND ME!' } },
    { scene: 'oku_appears', speaker: 'oku', text: {
      fr: 'Salut ! Moi c\'est Oku Oku, masque magique en carton recyclé. Mes conseils sont gratuits. Et ça se voit.',
      en: 'Hi! I\'m Oku Oku, magic mask made of recycled cardboard. My advice is free. And it shows.' } },
    { scene: 'departure', speaker: 'narrator', text: {
      fr: 'Lumen part donc sauver Zina à travers quatre îles. Toute ressemblance avec un jeu connu est fortuite. Nos avocats insistent.',
      en: 'So Lumen sets off across four islands to save Zina. Any resemblance to a famous game is accidental. Our lawyers insist.' } },
  ],
  island2: [
    { scene: 'monitor_desert', speaker: 'cortisol', text: {
      fr: 'Quoi ?! Tu as battu Papa Crabe Royal ? Il était à deux semaines de la retraite !',
      en: 'What?! You beat Royal Papa Crab? He was two weeks from retirement!' } },
    { scene: 'oku_desert', speaker: 'oku', text: {
      fr: 'Bienvenue dans les Dunes de Tozeur ! Pense à boire de l\'eau. Moi je peux pas, je suis en carton.',
      en: 'Welcome to the Tozeur Dunes! Remember to drink water. I can\'t, I\'m cardboard.' } },
    { scene: 'oku_desert', speaker: 'lumen', text: {
      fr: 'Tiens bon, Zina. J\'arrive. Juste après ce chameau qui me regarde bizarrement.',
      en: 'Hang on, Zina. I\'m coming. Right after this camel who keeps staring at me.' } },
  ],
  island3: [
    { scene: 'monitor_ice', speaker: 'cortisol', text: {
      fr: 'Le Djinn était mon meilleur stagiaire ! Bon, mon seul stagiaire. Il n\'était même pas payé !',
      en: 'The Djinn was my best intern! Well, my only intern. He wasn\'t even paid!' } },
    { scene: 'ice_arrival', speaker: 'oku', text: {
      fr: 'Le Glacier des Pingouins Grognons ! Mets une écharpe. Ah… tu en as déjà une. Frimeur.',
      en: 'Grumpy Penguin Glacier! Put on a scarf. Oh… you already have one. Show-off.' } },
    { scene: 'ice_arrival', speaker: 'lumen', text: {
      fr: 'Pourquoi ils sont grognons ? … Ah. Il fait -40.',
      en: 'Why are they grumpy? … Oh. It\'s minus 40.' } },
  ],
  island4: [
    { scene: 'factory_view', speaker: 'narrator', text: {
      fr: 'Enfin : l\'Usine du Dr Cortisol. Elle produit 4 000 tonnes de stress par jour, et zéro tonne de pauses café.',
      en: 'At last: Dr Cortisol\'s Factory. It produces 4,000 tons of stress a day, and zero tons of coffee breaks.' } },
    { scene: 'cortisol_lab', speaker: 'cortisol', text: {
      fr: 'Le Stressotron est presque prêt ! Bientôt tout le monde aura des cernes. MÊME LES RENARDS.',
      en: 'The Stressotron is almost ready! Soon everyone will have dark circles. EVEN FOXES.' } },
    { scene: 'cortisol_lab', speaker: 'zina', text: {
      fr: 'Lumen ! Dépêche-toi ! Il m\'oblige à écouter ses podcasts !',
      en: 'Lumen! Hurry! He\'s making me listen to his podcasts!' } },
  ],
  ending: [
    { scene: 'stressotron_broken', speaker: 'narrator', text: {
      fr: 'Le Stressotron s\'effondre dans un dernier « bip » très stressé. Une pâquerette pousse dedans. Personne ne sait pourquoi.',
      en: 'The Stressotron collapses with one last, very stressed "beep". A daisy grows inside. Nobody knows why.' } },
    { scene: 'cortisol_flee', speaker: 'cortisol', text: {
      fr: 'Je reviendrai ! Dans une suite ! Ou un remaster ! Ou un jeu de kart !',
      en: 'I\'ll be back! In a sequel! Or a remaster! Or a kart game!' } },
    { scene: 'reunion', speaker: 'zina', text: {
      fr: 'Tu es venu me chercher ! … Tu as gardé des sandwichs ? Sans sable ?',
      en: 'You came for me! … Did you save any sandwiches? Without sand?' } },
    { scene: 'reunion', speaker: 'oku', text: {
      fr: 'Bravo ! Je savais que tu y arriverais. Enfin, je l\'ai dit après. Mais je le pensais avant.',
      en: 'Bravo! I knew you could do it. Well, I said it afterwards. But I thought it before.' } },
    { scene: 'fin', speaker: 'narrator', text: {
      fr: 'FIN. Merci d\'avoir joué à une mauvaise copie. (Psst : il paraît que les chaussettes dorées ouvrent quelque chose…)',
      en: 'THE END. Thanks for playing a bad copy. (Psst: rumour says golden socks open something…)' } },
  ],
  secret: [
    { scene: 'golden_moon', speaker: 'oku', text: {
      fr: 'Tu as trouvé TOUTES ces chaussettes dorées ? C\'est… perturbant. Tu devrais sortir plus.',
      en: 'You found ALL those golden socks? That\'s… disturbing. You should go outside more.' } },
    { scene: 'golden_moon', speaker: 'narrator', text: {
      fr: 'Dans le ciel, la Lune Dorée s\'allume. Quelqu\'un a branché une rallonge dessus.',
      en: 'In the sky, the Golden Moon lights up. Someone plugged an extension cord into it.' } },
    { scene: 'golden_cortisol', speaker: 'cortisol', text: {
      fr: 'Contemple ma forme ultime : CORTISOL DORÉ ! Même mon stress est en or massif !',
      en: 'Behold my ultimate form: GOLDEN CORTISOL! Even my stress is solid gold!' } },
  ],
  secret_ending: [
    { scene: 'hammock', speaker: 'cortisol', text: {
      fr: 'Je… je crois que je suis… détendu ? C\'est ça, la sensation ? C\'est horrible. J\'adore.',
      en: 'I… I think I\'m… relaxed? Is that the feeling? It\'s horrible. I love it.' } },
    { scene: 'hammock', speaker: 'zina', text: {
      fr: 'Bon. On l\'invite au prochain pique-nique ?',
      en: 'So. Do we invite him to the next picnic?' } },
    { scene: 'true_end', speaker: 'narrator', text: {
      fr: 'VRAIE FIN. Lumen est un héros. Et toujours pas un bandicoot. Merci d\'avoir tout fini, tu es incroyable.',
      en: 'TRUE ENDING. Lumen is a hero. And still not a bandicoot. Thanks for finishing everything, you\'re amazing.' } },
  ],
};

export const STORY_IDS = Object.keys(STORIES);
