export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
]

export const DEFAULT_LANGUAGE = 'en'

export const translations = {
  de: {
    appName: 'SmartContentAI',
    appTagline: 'KI-gestützte Content-Zentrale',

    nav: {
      platforms: 'Kanäle',
      create: 'Erstellen',
      schedule: 'Kalender',
      analytics: 'Berichte',
      settings: 'Einstellungen',
    },

    platforms: {
      title: 'Kanäle auswählen',
      subtitle: 'Verbinde die Social-Media-Konten, auf denen du veröffentlichen möchtest.',
      selected: 'Kanäle ausgewählt',
      noneSelected: 'Noch keine Kanäle ausgewählt',
      connected: 'Verbunden',
      notConnected: 'Nicht verbunden',
      selectAll: 'Alle auswählen',
      clearAll: 'Auswahl löschen',
      tipTitle: 'Ein Inhalt, überall',
      tipBody: 'Wenn du mehrere Kanäle auswählst, wird dein Inhalt automatisch an das Format jeder Plattform angepasst.',
    },

    create: {
      title: 'Inhalt erstellen',
      subtitle: 'Lade ein Bild hoch – die KI schreibt den Text dazu.',
      formatLabel: 'Inhaltsformat',
      toneLabel: 'Tonalität',
      topicLabel: 'Richtung vorgeben (optional)',
      topicPlaceholder: 'z. B. Anmeldung betonen, Konzentration hervorheben ...',
      targetLabel: 'Zielkanäle',
      generate: 'Inhalt erstellen',
      generating: 'Wird erstellt...',
      resultLabel: 'Erstellter Inhalt',
      emptyResult: 'Noch kein Text erstellt. Lade ein Bild hoch und klicke auf „Inhalt erstellen“ — die KI schreibt passend zum Bild.',
      copy: 'Kopieren',
      copied: 'Kopiert',
      regenerate: 'Neu erstellen',
      save: 'Als Entwurf speichern',
      needTopic: 'Bitte gib zuerst ein Thema ein.',
      needPlatform: 'Bitte wähle mindestens einen Kanal aus.',
      generated: 'Inhalt ist fertig!',
      saved: 'In den Entwürfen gespeichert.',
      characters: 'Zeichen',
      postTypeLabel: 'Beitragsart',
      postTypes: {
        FEED: 'Beitrag',
        STORY: 'Story',
        REELS: 'Reels',
      },
      reelsUnavailable: 'Video-Unterstützung für Reels ist noch nicht fertig.',
      storyNoCaption: 'In Storys erscheint kein Text — Instagram nimmt keine Bildunterschrift an.',
      media: {
        label: 'Bild',
        pick: 'Bild auswählen oder hierher ziehen',
        hint: 'Wird automatisch in JPEG umgewandelt · max. 8 MB',
        change: 'Ändern',
        remove: 'Entfernen',
        uploading: 'Wird hochgeladen…',
        ready: 'Hochgeladen',
        publish: 'Auf Instagram veröffentlichen',
        publishing: 'Wird veröffentlicht…',
        processing: 'Instagram verarbeitet das Bild…',
        published: 'Veröffentlicht! 🎉',
        needImage: 'Wähle zuerst ein Bild aus.',
        notAnImage: 'Das ist keine Bilddatei.',
        tooTall: 'Bild zu hoch — Instagram erlaubt höchstens 4:5.',
        tooWide: 'Bild zu breit — Instagram erlaubt höchstens 1,91:1.',
        uploadFailed: 'Bild konnte nicht hochgeladen werden.',
        uploadFailedShort: 'Nicht hochgeladen',
        uploadBlocked:
          'Der Browser konnte den Upload zum Bildspeicher nicht senden. Häufigste Ursache: {origin} fehlt in den CORS-Einstellungen des R2-Buckets. ({reason})',
        publishFailed: 'Veröffentlichung fehlgeschlagen.',
      },
      formats: {
        caption: 'Beitragstext',
        hashtags: 'Hashtag-Set',
        hook: 'Aufmerksamkeitsstarker Einstieg',
        cta: 'Handlungsaufruf',
        thread: 'Serie / Thread',
      },
      tones: {
        friendly: 'Freundlich',
        professional: 'Professionell',
        playful: 'Verspielt',
        bold: 'Mutig',
      },
      ideasTitle: 'Fertige Ideen',
      ideas: {
        launch: 'Produktlaunch',
        tip: 'Tipp der Woche',
        story: 'Kundenstory',
        behind: 'Hinter den Kulissen',
      },
    },

    schedule: {
      title: 'Content-Kalender',
      subtitle: 'Plane, verwalte und automatisiere deine Social-Media-Inhalte.',
      createPost: 'Beitrag erstellen',
      aiPlan: 'AI planen',
      loading: 'Kalender wird geladen …',

      today: 'Heute',
      views: { day: 'Tag', week: 'Woche', month: 'Monat', list: 'Liste' },
      allChannels: 'Alle Kanäle',
      previousPeriod: 'Zurück',
      nextPeriod: 'Weiter',

      todayTitle: 'Heute',
      todayNone: 'Nichts geplant',
      todayOne: '1 geplanter Beitrag',
      todayMany: '{n} geplante Beiträge',
      nextUp: 'Als Nächstes',
      nothingScheduled: 'Nichts geplant',
      morePosts: '+{n} weitere',

      status: {
        draft: 'Entwurf',
        scheduled: 'Geplant',
        publishing: 'Wird veröffentlicht',
        published: 'Veröffentlicht',
        failed: 'Fehlgeschlagen',
      },

      scheduledContent: 'Geplante Beiträge',
      queueTitle: 'Veröffentlichungs-Warteschlange',
      queueEmpty: 'Nichts in der Warteschlange.',
      tomorrow: 'Morgen',

      columns: {
        date: 'Datum',
        time: 'Uhrzeit',
        content: 'Inhalt',
        platform: 'Kanal',
        status: 'Status',
        actions: 'Aktionen',
      },

      actions: {
        edit: 'Bearbeiten',
        reschedule: 'Neu planen',
        duplicate: 'Duplizieren',
        delete: 'Löschen',
        publishNow: 'Jetzt veröffentlichen',
        retry: 'Erneut versuchen',
        save: 'Speichern',
        cancel: 'Abbrechen',
      },

      drawer: {
        newTitle: 'Neuer Beitrag',
        editTitle: 'Beitrag bearbeiten',
        preview: 'Vorschau',
        platform: 'Kanal',
        date: 'Datum',
        time: 'Uhrzeit',
        caption: 'Text',
        captionPlaceholder: 'Text des Beitrags …',
        media: 'Bild',
        hashtags: 'Hashtags',
        noHashtags: 'Keine Hashtags im Text.',
        status: 'Status',
        writeWithAi: 'Text mit KI schreiben',
        writing: 'KI schreibt …',
        needImage: 'Lade zuerst ein Bild hoch.',
        needTime: 'Wähle Datum und Uhrzeit.',
        failedTitle: 'Veröffentlichung fehlgeschlagen',
        keepDraft: 'Als Entwurf speichern',
        schedule: 'Einplanen',
        notPublishable:
          'Für diesen Kanal ist noch keine Veröffentlichung eingerichtet. Der Beitrag bleibt ein Entwurf.',
      },

      ai: {
        cardTitle: 'AI Smart Scheduling',
        cardBody:
          'Lass die KI die besten Veröffentlichungszeiten aus deiner Reichweite und deinen bisherigen Beiträgen ableiten.',
        measured: 'Aus {n} gemessenen Beiträgen abgeleitet',
        preferred: 'Empfohlene Startzeiten',
        preferredWhy:
          'Noch {n} Beiträge nötig, bevor Zeiten aus echter Performance abgeleitet werden können. Bis dahin werden deine bevorzugten Zeiten verwendet.',
        recommendedTime: 'Empfohlene Zeit',
        modalTitle: 'AI Smart Scheduling',
        count: 'Anzahl Beiträge',
        channels: 'Kanäle',
        period: 'Zeitraum',
        from: 'Von',
        to: 'Bis',
        strategy: 'Strategie',
        strategies: {
          engagement: 'Beste Interaktionszeiten',
          even: 'Gleichmäßig verteilen',
          preferred: 'Bevorzugte Zeiten',
        },
        goal: 'Hauptziel',
        goals: { engagement: 'Interaktion', reach: 'Reichweite', consistency: 'Regelmäßigkeit' },
        submit: 'Mit AI einplanen',
        slotsNote:
          'Es werden {n} leere Entwürfe zu diesen Zeiten angelegt. Füge jedem ein Bild und einen Text hinzu, damit er veröffentlicht werden kann.',
        noRoom: 'Im gewählten Zeitraum liegt kein Termin mehr in der Zukunft.',
        created: '{n} Entwürfe im Kalender angelegt.',
      },

      settings: {
        title: 'Veröffentlichungs-Einstellungen',
        timezone: 'Zeitzone',
        postsPerDay: 'Beiträge pro Tag',
        preferredTimes: 'Bevorzugte Zeiten',
        addTime: 'Zeit hinzufügen',
        saved: 'Einstellungen gespeichert.',
        tzMismatch:
          'Dein Browser läuft auf {browser}. Zeiten werden in der Browser-Zeitzone angezeigt und gespeichert.',
      },

      empty: {
        title: 'Noch keine geplanten Inhalte',
        body: 'Erstelle deinen ersten Beitrag oder lass die KI deinen Veröffentlichungsplan aufbauen.',
        openEditor: 'Zum vollständigen Editor',
      },

      cronOff:
        'Automatische Veröffentlichung läuft erst auf der veröffentlichten Netlify-Seite. Lokal bleiben geplante Beiträge stehen, bis du sie selbst veröffentlichst.',

      toast: {
        saved: 'Beitrag gespeichert.',
        deleted: 'Beitrag gelöscht.',
        rescheduled: 'Beitrag neu geplant.',
        duplicated: 'Beitrag dupliziert.',
        published: 'Beitrag veröffentlicht.',
        retrying: 'Wird erneut versucht …',
      },

      needPlatform: 'Wähle zuerst unter „Kanäle“ mindestens einen Kanal aus.',
      noAccounts: 'Noch kein Konto verbunden — füge unter „Einstellungen“ einen Kanal hinzu.',
    },

    analytics: {
      title: 'Performance-Bericht',
      subtitle: 'Echte Zahlen zu deinen veröffentlichten Beiträgen.',
      refresh: 'Zahlen aktualisieren',
      refreshing: 'Wird abgerufen …',
      refreshed: 'Zahlen von Instagram aktualisiert.',
      loading: 'Beiträge werden geladen …',
      totals: 'Gesamtwerte',
      published: 'Beiträge',
      views: 'Aufrufe',
      reach: 'Reichweite',
      likes: 'Likes',
      comments: 'Kommentare',
      interactions: 'Interaktionen',
      engagement: 'Interaktionsrate',
      empty: 'Noch kein Beitrag veröffentlicht.',
      emptyHint: 'Sobald du über „Erstellen“ postest, erscheinen hier die echten Zahlen.',
      emptyAction: 'Beitrag erstellen',

      bestTime: 'Bester Veröffentlichungszeitpunkt',
      bestTimeHint: 'Gemessen in deiner Ortszeit, nach Reichweite pro Beitrag.',
      recommend: 'Poste zwischen {band}.',
      recommendDetail:
        'Ø {reach} Reichweite bei {count} Beiträgen — mehr als {runnerBand} mit Ø {runnerReach}.',
      needMore: 'Noch {n} Beiträge nötig',
      needMoreHint:
        'Eine Empfehlung aus so wenigen Beiträgen wäre geraten, nicht gemessen. Die Tabelle unten zeigt trotzdem schon alles, was gemessen wurde.',
      needSpread: 'Beiträge über den Tag verteilen',
      needSpreadHint:
        'Fast alles wurde zur selben Tageszeit gepostet. Ohne Vergleich lässt sich kein bester Zeitpunkt bestimmen.',
      byHour: 'Nach Tageszeit',
      perPost: 'pro Beitrag',
      postsOne: '{n} Beitrag',
      postsMany: '{n} Beiträge',
      noData: 'keine Daten',

      history: 'Veröffentlichte Beiträge',
      pending: 'Zahlen folgen',
      pendingHint: 'Instagram liefert Insights mit einigen Stunden Verzögerung.',
    },

    settings: {
      title: 'Einstellungen',
      subtitle: 'Verbinde deine Konten und verwalte die App-Sprache.',
      loading: 'Konten werden geladen …',

      connectedTitle: 'Verbundene Konten',
      storageBroken: 'Speicher nicht erreichbar — nichts kann gespeichert oder gelesen werden.',
      noneConnected: 'Noch kein Konto verbunden.',
      addChannel: 'Kanal hinzufügen',
      addTitle: 'Kanal hinzufügen',
      addHint:
        'Füge das Zugriffstoken aus deiner Meta-App ein. Die Konto-ID und der Benutzername werden automatisch von Instagram gelesen — du musst nichts weiter eintragen.',
      token: 'Zugriffstoken',
      checkAndConnect: 'Prüfen und verbinden',
      checking: 'Wird geprüft …',
      whereToken: 'Wo finde ich das Token?',
      connected: '@{username} verbunden.',
      removed: '@{username} getrennt.',
      disconnect: 'Trennen',

      tokenOk: 'Token gültig',
      tokenValidFor: 'Token noch {days} Tage gültig',
      tokenValidForEst: 'Token noch ca. {days} Tage gültig (geschätzt)',
      expiresIn: 'Token läuft in {days} Tagen ab',
      expiresInEst: 'Token läuft in ca. {days} Tagen ab (geschätzt)',
      autoRefresh: 'Wird automatisch verlängert',
      lastRefreshed: 'Zuletzt verlängert am {date}',

      stayConnectedTitle: 'Einmal verbinden, dauerhaft verbunden',
      stayConnectedBody:
        'Instagram-Token laufen nach 60 Tagen ab. Die App verlängert sie täglich automatisch, solange ein Konto verbunden ist — du musst einen Kanal also nur ein einziges Mal hinzufügen. Nur wenn eine Verlängerung fehlschlägt, erscheint hier eine Warnung.',

      securityTitle: 'Sicherheit',
      securityBody:
        'Token werden ausschließlich auf dem Server gespeichert und nie an den Browser zurückgegeben — hier siehst du nur die letzten vier Zeichen. Teile dein App-Passwort mit niemandem.',

      languageTitle: 'App-Sprache',
      languageHint: 'Die gesamte Oberfläche und erstellte Inhalte erscheinen in der gewählten Sprache.',
      languageChanged: 'Sprache geändert.',
    },

    gate: {
      subtitle: 'Bitte gib das App-Passwort ein.',
      label: 'App-Passwort',
      submit: 'Anmelden',
      checking: 'Wird geprüft …',
      wrong: 'Falsches Passwort.',
    },

    common: {
      back: 'Zurück',
      close: 'Schließen',
      of: '/',
    },
  },

  en: {
    appName: 'SmartContentAI',
    appTagline: 'AI-powered content hub',

    nav: {
      platforms: 'Channels',
      create: 'Create',
      schedule: 'Schedule',
      analytics: 'Reports',
      settings: 'Settings',
    },

    platforms: {
      title: 'Pick your channels',
      subtitle: 'Connect the social accounts you want to publish to.',
      selected: 'channels selected',
      noneSelected: 'No channels selected yet',
      connected: 'Connected',
      notConnected: 'Not connected',
      selectAll: 'Select all',
      clearAll: 'Clear selection',
      tipTitle: 'One post, everywhere',
      tipBody: 'Select multiple channels and your content is automatically adapted to each platform’s format.',
    },

    create: {
      title: 'Create content',
      subtitle: 'Upload an image and the AI writes the copy for it.',
      formatLabel: 'Content format',
      toneLabel: 'Tone of voice',
      topicLabel: 'Steer the copy (optional)',
      topicPlaceholder: 'e.g. push sign-ups, highlight concentration ...',
      targetLabel: 'Target channels',
      generate: 'Generate content',
      generating: 'Generating...',
      resultLabel: 'Generated content',
      emptyResult: 'Nothing written yet. Upload an image and hit “Generate content” — the AI writes from the picture.',
      copy: 'Copy',
      copied: 'Copied',
      regenerate: 'Regenerate',
      save: 'Save as draft',
      needTopic: 'Please enter a topic first.',
      needPlatform: 'Please select at least one channel.',
      generated: 'Content is ready!',
      saved: 'Saved to drafts.',
      characters: 'characters',
      postTypeLabel: 'Post type',
      postTypes: {
        FEED: 'Feed post',
        STORY: 'Story',
        REELS: 'Reels',
      },
      reelsUnavailable: 'Video support for Reels is not ready yet.',
      storyNoCaption: 'Stories show no text — Instagram does not accept a caption.',
      media: {
        label: 'Image',
        pick: 'Choose an image or drop it here',
        hint: 'Converted to JPEG automatically · 8 MB max',
        change: 'Change',
        remove: 'Remove',
        uploading: 'Uploading…',
        ready: 'Uploaded',
        publish: 'Publish to Instagram',
        publishing: 'Publishing…',
        processing: 'Instagram is processing the image…',
        published: 'Published! 🎉',
        needImage: 'Choose an image first.',
        notAnImage: 'That is not an image file.',
        tooTall: 'Image is too tall — Instagram allows 4:5 at most.',
        tooWide: 'Image is too wide — Instagram allows 1.91:1 at most.',
        uploadFailed: 'Could not upload the image.',
        uploadFailedShort: 'Not uploaded',
        uploadBlocked:
          'The browser could not send the upload to the image storage. Most often this means {origin} is missing from the R2 bucket’s CORS settings. ({reason})',
        publishFailed: 'Publishing failed.',
      },
      formats: {
        caption: 'Post caption',
        hashtags: 'Hashtag set',
        hook: 'Attention hook',
        cta: 'Call to action',
        thread: 'Thread / series',
      },
      tones: {
        friendly: 'Friendly',
        professional: 'Professional',
        playful: 'Playful',
        bold: 'Bold',
      },
      ideasTitle: 'Ready-made ideas',
      ideas: {
        launch: 'Product launch',
        tip: 'Tip of the week',
        story: 'Customer story',
        behind: 'Behind the scenes',
      },
    },

    schedule: {
      title: 'Content Calendar',
      subtitle: 'Plan, manage and automate your social media content.',
      createPost: 'Create post',
      aiPlan: 'AI plan',
      loading: 'Loading calendar …',

      today: 'Today',
      views: { day: 'Day', week: 'Week', month: 'Month', list: 'List' },
      allChannels: 'All channels',
      previousPeriod: 'Previous',
      nextPeriod: 'Next',

      todayTitle: 'Today',
      todayNone: 'Nothing scheduled',
      todayOne: '1 scheduled post',
      todayMany: '{n} scheduled posts',
      nextUp: 'Next up',
      nothingScheduled: 'Nothing scheduled',
      morePosts: '+{n} more',

      status: {
        draft: 'Draft',
        scheduled: 'Scheduled',
        publishing: 'Publishing',
        published: 'Published',
        failed: 'Failed',
      },

      scheduledContent: 'Scheduled content',
      queueTitle: 'Publishing queue',
      queueEmpty: 'Nothing queued.',
      tomorrow: 'Tomorrow',

      columns: {
        date: 'Date',
        time: 'Time',
        content: 'Content',
        platform: 'Channel',
        status: 'Status',
        actions: 'Actions',
      },

      actions: {
        edit: 'Edit',
        reschedule: 'Reschedule',
        duplicate: 'Duplicate',
        delete: 'Delete',
        publishNow: 'Publish now',
        retry: 'Retry',
        save: 'Save',
        cancel: 'Cancel',
      },

      drawer: {
        newTitle: 'New post',
        editTitle: 'Edit post',
        preview: 'Preview',
        platform: 'Channel',
        date: 'Date',
        time: 'Time',
        caption: 'Caption',
        captionPlaceholder: 'Post caption …',
        media: 'Image',
        hashtags: 'Hashtags',
        noHashtags: 'No hashtags in the caption.',
        status: 'Status',
        writeWithAi: 'Write caption with AI',
        writing: 'AI is writing …',
        needImage: 'Upload an image first.',
        needTime: 'Pick a date and time.',
        failedTitle: 'Publishing failed',
        keepDraft: 'Save as draft',
        schedule: 'Schedule',
        notPublishable:
          'Publishing is not connected for this channel yet. The post stays a draft.',
      },

      ai: {
        cardTitle: 'AI Smart Scheduling',
        cardBody:
          'Let AI derive the best publishing times from your reach and your previous posts.',
        measured: 'Derived from {n} measured posts',
        preferred: 'Recommended starting times',
        preferredWhy:
          '{n} more posts are needed before times can be derived from real performance. Until then your preferred times are used.',
        recommendedTime: 'Recommended time',
        modalTitle: 'AI Smart Scheduling',
        count: 'Number of posts',
        channels: 'Channels',
        period: 'Period',
        from: 'From',
        to: 'To',
        strategy: 'Scheduling strategy',
        strategies: {
          engagement: 'Best engagement times',
          even: 'Evenly distribute',
          preferred: 'Preferred times',
        },
        goal: 'Primary goal',
        goals: { engagement: 'Engagement', reach: 'Reach', consistency: 'Consistency' },
        submit: 'Schedule with AI',
        slotsNote:
          'This creates {n} empty drafts at these times. Add an image and caption to each before it can publish.',
        noRoom: 'No slot in the chosen period is still in the future.',
        created: '{n} drafts added to the calendar.',
      },

      settings: {
        title: 'Publishing settings',
        timezone: 'Timezone',
        postsPerDay: 'Posts per day',
        preferredTimes: 'Preferred publishing times',
        addTime: 'Add time',
        saved: 'Settings saved.',
        tzMismatch:
          'Your browser runs on {browser}. Times are shown and stored in the browser timezone.',
      },

      empty: {
        title: 'No scheduled content yet',
        body: 'Create your first post or let AI build your publishing schedule.',
        openEditor: 'Open the full editor',
      },

      cronOff:
        'Automatic publishing only runs on the deployed Netlify site. Locally, scheduled posts wait until you publish them yourself.',

      toast: {
        saved: 'Post saved.',
        deleted: 'Post deleted.',
        rescheduled: 'Post rescheduled.',
        duplicated: 'Post duplicated.',
        published: 'Post published.',
        retrying: 'Retrying …',
      },

      needPlatform: 'Select at least one channel under Channels first.',
      noAccounts: 'No account connected yet — add a channel under Settings.',
    },

    analytics: {
      title: 'Performance report',
      subtitle: 'Real numbers from the posts you have published.',
      refresh: 'Refresh numbers',
      refreshing: 'Fetching …',
      refreshed: 'Numbers refreshed from Instagram.',
      loading: 'Loading posts …',
      totals: 'Totals',
      published: 'Posts',
      views: 'Views',
      reach: 'Reach',
      likes: 'Likes',
      comments: 'Comments',
      interactions: 'Interactions',
      engagement: 'Engagement rate',
      empty: 'Nothing published yet.',
      emptyHint: 'As soon as you post from Create, the real numbers show up here.',
      emptyAction: 'Create a post',

      bestTime: 'Best time to post',
      bestTimeHint: 'Measured in your local time, ranked by reach per post.',
      recommend: 'Post between {band}.',
      recommendDetail:
        '{reach} average reach across {count} posts — ahead of {runnerBand} at {runnerReach}.',
      needMore: '{n} more posts needed',
      needMoreHint:
        'A recommendation from this few posts would be a guess, not a measurement. The table below still shows everything that has been measured.',
      needSpread: 'Spread posts across the day',
      needSpreadHint:
        'Almost everything went out at the same time of day. With nothing to compare, no best time can be found.',
      byHour: 'By time of day',
      perPost: 'per post',
      postsOne: '{n} post',
      postsMany: '{n} posts',
      noData: 'no data',

      history: 'Published posts',
      pending: 'Numbers pending',
      pendingHint: 'Instagram reports insights a few hours after publishing.',
    },

    settings: {
      title: 'Settings',
      subtitle: 'Connect your accounts and manage the app language.',
      loading: 'Loading accounts …',

      connectedTitle: 'Connected accounts',
      storageBroken: 'Storage unreachable — nothing can be saved or read.',
      noneConnected: 'No account connected yet.',
      addChannel: 'Add channel',
      addTitle: 'Add a channel',
      addHint:
        'Paste the access token from your Meta app. The account id and username are read back from Instagram automatically — there is nothing else to fill in.',
      token: 'Access token',
      checkAndConnect: 'Check and connect',
      checking: 'Checking …',
      whereToken: 'Where do I find the token?',
      connected: '@{username} connected.',
      removed: '@{username} disconnected.',
      disconnect: 'Disconnect',

      tokenOk: 'Token valid',
      tokenValidFor: 'Token valid for another {days} days',
      tokenValidForEst: 'Token valid for roughly {days} more days (estimated)',
      expiresIn: 'Token expires in {days} days',
      expiresInEst: 'Token expires in roughly {days} days (estimated)',
      autoRefresh: 'Renewed automatically',
      lastRefreshed: 'Last renewed on {date}',

      stayConnectedTitle: 'Connect once, stay connected',
      stayConnectedBody:
        'Instagram tokens expire after 60 days. The app renews them automatically every day for as long as an account is connected, so a channel only ever has to be added once. A warning appears here only if a renewal fails.',

      securityTitle: 'Security',
      securityBody:
        'Tokens are stored on the server only and never sent back to the browser — you see just the last four characters here. Never share your app password.',

      languageTitle: 'App language',
      languageHint: 'The whole interface and generated content use the language you pick.',
      languageChanged: 'Language changed.',
    },

    gate: {
      subtitle: 'Enter the app password to continue.',
      label: 'App password',
      submit: 'Sign in',
      checking: 'Checking …',
      wrong: 'Wrong password.',
    },

    common: {
      back: 'Back',
      close: 'Close',
      of: '/',
    },
  },
}
