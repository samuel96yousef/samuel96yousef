/*
 * Demodata för POC:n. Organisationen "Nordpension" är påhittad.
 * Namngivna personer och team följer GUI-skisserna; övriga arbetare genereras
 * deterministiskt så att "Återställ demodata" alltid ger samma resultat.
 */
var OOSSeed = (function () {
  var U = typeof OOSUtil !== 'undefined' ? OOSUtil : require('./util.js');

  var COMPETENCES = [
    ['c_java', 'Java', 'it', 'Utveckling', 'Backendutveckling i Java, inklusive Spring Framework.'],
    ['c_dotnet', '.NET och C#', 'it', 'Utveckling', 'Utveckling av tjänster och applikationer i .NET.'],
    ['c_react', 'React och frontend', 'it', 'Utveckling', 'Frontendutveckling i React och TypeScript.'],
    ['c_python', 'Python', 'it', 'Utveckling', 'Utveckling i Python för backend, automation och analys.'],
    ['c_abap', 'SAP ABAP', 'it', 'Utveckling', 'Utveckling och anpassning i SAP med ABAP.'],
    ['c_sapcrm', 'SAP CRM', 'it', 'Utveckling', 'Konfiguration och förvaltning av SAP CRM.'],
    ['c_sql', 'Databaser (SQL)', 'it', 'Data & Analys', 'Design, utveckling och optimering av databaser.'],
    ['c_api', 'Integration (API)', 'it', 'Integration', 'Design och utveckling av API:er och integrationsflöden.'],
    ['c_devops', 'DevOps', 'it', 'Drift & Infrastruktur', 'CI/CD, automatiserade leveranser och observabilitet.'],
    ['c_cloud', 'Molnplattform (Azure)', 'it', 'Drift & Infrastruktur', 'Drift och utveckling av molnbaserad plattform.'],
    ['c_infra', 'Drift och infrastruktur', 'it', 'Drift & Infrastruktur', 'Servrar, nätverk och driftprocesser.'],
    ['c_arch', 'Systemarkitektur', 'it', 'Arkitektur', 'Arkitektur för IT-lösningar och systemlandskap.'],
    ['c_test', 'Test och kvalitet', 'it', 'Test & QA', 'Testning, testledning och kvalitetssäkring.'],
    ['c_testauto', 'Testautomation', 'it', 'Test & QA', 'Automatiserade tester i leveranskedjan.'],
    ['c_ux', 'UX/UI-design', 'it', 'Design', 'Design av användargränssnitt och användarupplevelser.'],
    ['c_sec', 'Informationssäkerhet', 'it', 'Säkerhet', 'Säkerhetsarkitektur, behörigheter och riskanalys.'],
    ['c_data', 'Dataanalys', 'it', 'Data & Analys', 'Analys av data och framtagning av beslutsunderlag.'],
    ['c_dataeng', 'Data engineering', 'it', 'Data & Analys', 'Dataflöden, datalager och datakvalitet.'],
    ['c_rpa', 'RPA-utveckling', 'it', 'Automation', 'Automatisering av processer med mjukvarurobotar.'],
    ['c_ai', 'AI och maskininlärning', 'it', 'Automation', 'Tillämpning av AI-modeller i verksamhetsflöden.'],
    ['c_po', 'Produktledning', 'business', 'Ledning', 'Prioritering, målbild och ägarskap för en produkt.'],
    ['c_pm', 'Projektledning', 'business', 'Ledning', 'Planering och genomförande av initiativ över organisationsgränser.'],
    ['c_change', 'Förändringsledning', 'business', 'Ledning', 'Införande av förändringar i verksamheten.'],
    ['c_ba', 'Verksamhetsanalys', 'business', 'Analys', 'Analys av verksamhetsbehov och processer.'],
    ['c_req', 'Kravanalys', 'business', 'Analys', 'Framtagning och nedbrytning av krav.'],
    ['c_process', 'Processutveckling', 'business', 'Analys', 'Kartläggning och förbättring av verksamhetsprocesser.'],
    ['c_bizarch', 'Verksamhetsarkitektur', 'business', 'Arkitektur', 'Förmågor, informationsmodeller och processarkitektur.'],
    ['c_itp', 'ITP-regelverk (ITP 1 och ITP 2)', 'business', 'Verksamhetskunskap', 'Kollektivavtalad tjänstepension enligt ITP 1 och ITP 2.'],
    ['c_penadm', 'Pensionsadministration', 'business', 'Verksamhetskunskap', 'Administration av pensionsavtal, val och utbetalningar.'],
    ['c_premium', 'Premier och fakturering', 'business', 'Verksamhetskunskap', 'Premieberäkning, fakturering och arbetsgivarrapportering.'],
    ['c_customer', 'Kunddialog och rådgivning', 'business', 'Verksamhetskunskap', 'Kundmöten, rådgivning och kundärenden.'],
    ['c_finance', 'Ekonomi och redovisning', 'business', 'Verksamhetskunskap', 'Ekonomistyrning, redovisning och finansiell rapportering.'],
    ['c_legal', 'Juridik och regelefterlevnad', 'business', 'Verksamhetskunskap', 'Lagkrav, avtal och regelefterlevnad.']
  ];

  var DELIVERY_DOMAINS = [
    ['dd_km', 'Kund och Marknad', 'business', 'Hantera kundrelationer, marknad och försäljning.', 'Säkerställa en attraktiv och konkurrenskraftig kundupplevelse genom effektiv marknad, försäljning och kundservice.'],
    ['dd_pu', 'Pension och Utbetalning', 'business', 'Administration av pensionsavtal och utbetalningar.', 'Säkerställa korrekt och effektiv pensionsadministration och utbetalning i rätt tid.'],
    ['dd_ag', 'Arbetsgivarstöd', 'business', 'Stöd till arbetsgivare kring avtal, rapportering och premier.', 'Göra det enkelt för arbetsgivare att teckna avtal, rapportera löner och betala premier.'],
    ['dd_ss', 'Stöd och Styrning', 'business', 'Verksamhetsstöd, styrning, risk och regelefterlevnad.', 'Ge verksamheten stabil styrning, kontroll och gemensamma stödfunktioner.'],
    ['dd_uf', 'Utveckling och Förändring', 'it', 'Gemensam utveckling, plattformar och innovation.', 'Tillhandahålla gemensamma plattformar och förmågor som gör övriga domäner snabbare.']
  ];

  var DOMAINS = [
    ['d_ks', 'Kundservice', 'business', 'Hantera kundfrågor, ärenden och rådgivning.', 'Säkerställa hög kundnöjdhet genom effektiv hantering av kundärenden och proaktiv rådgivning.'],
    ['d_fm', 'Försäljning och Marknad', 'business', 'Marknadsföring, försäljning och partnerhantering.', 'Öka kännedom och försäljning genom rätt budskap i rätt kanal.'],
    ['d_penadm', 'Pensionsadministration', 'business', 'Administration av pensionsavtal och pensionsval.', 'Säkerställa att varje pensionsavtal hanteras korrekt enligt ITP-regelverket.'],
    ['d_utbet', 'Utbetalning', 'business', 'Beräkning och utbetalning av pensioner.', 'Rätt pension till rätt person i rätt tid.'],
    ['d_avtal', 'Avtal och Produkter', 'business', 'Avtalsteckning, produktvillkor och avtalsregister.', 'Hålla avtal och produktvillkor korrekta och lätta att förstå.'],
    ['d_rapport', 'Rapportering', 'business', 'Arbetsgivarnas löne- och händelserapportering.', 'Göra rapporteringen enkel och fri från fel för arbetsgivarna.'],
    ['d_premier', 'Premier och Fakturering', 'business', 'Premieberäkning och fakturering till arbetsgivare.', 'Korrekt premie och faktura varje månad.'],
    ['d_ekonomi', 'Ekonomi och Finans', 'business', 'Ekonomistyrning, redovisning och finansiell rapportering.', 'Ge ledningen tillförlitliga ekonomiska underlag.'],
    ['d_risk', 'Risk och Regelefterlevnad', 'business', 'Riskhantering, compliance och dataskydd.', 'Säkerställa att verksamheten följer lagar, avtal och interna regler.'],
    ['d_intern', 'Intern Service', 'business', 'Interna stödtjänster för medarbetare.', 'Ge medarbetarna verktyg och service som fungerar.'],
    ['d_produkt', 'Produktutveckling', 'business', 'Utveckling av nya och befintliga pensionstjänster.', 'Ta fram nya tjänster och förbättra befintliga utifrån kundbehov.'],
    ['d_digital', 'Digitala kanaler', 'it', 'Webb, portaler och appar mot kunder och arbetsgivare.', 'Tillhandahålla stabila och moderna digitala kanaler.'],
    ['d_crm', 'CRM backend', 'it', 'SAP CRM och avtalsnära backend-tjänster.', 'Ge en stabil och korrekt bas för avtal och kunddata.'],
    ['d_integration', 'Integration', 'it', 'Integrationstjänster och API:er.', 'Göra det enkelt och säkert att koppla ihop system internt och externt.'],
    ['d_data', 'Data & Analys', 'it', 'Dataplattformar, analys och rapportering.', 'Göra data tillgänglig och pålitlig för beslut.'],
    ['d_infra', 'IT-infrastruktur', 'it', 'Teknisk infrastruktur, nätverk och plattformar.', 'Stabil och kostnadseffektiv drift.'],
    ['d_sec', 'Säkerhet', 'it', 'Säkerhetslösningar och åtkomsthantering.', 'Skydda information och system mot hot.'],
    ['d_penplat', 'Pensionsplattform', 'it', 'Kärnsystem för pensionsadministration och utbetalning.', 'En modern och korrekt plattform för pensionsflödet.'],
    ['d_automation', 'Automation', 'it', 'RPA, AI-agenter och processautomation.', 'Frigöra tid i verksamheten genom automatisering.']
  ];

  var CLUSTERS = [
    ['dd_km', 'd_ks', 'primary'], ['dd_km', 'd_fm', 'primary'], ['dd_km', 'd_digital', 'primary'],
    ['dd_pu', 'd_penadm', 'primary'], ['dd_pu', 'd_utbet', 'primary'], ['dd_pu', 'd_penplat', 'primary'], ['dd_pu', 'd_integration', 'supportive'],
    ['dd_ag', 'd_avtal', 'primary'], ['dd_ag', 'd_rapport', 'primary'], ['dd_ag', 'd_premier', 'primary'], ['dd_ag', 'd_crm', 'primary'],
    ['dd_ag', 'd_integration', 'supportive'], ['dd_ag', 'd_digital', 'supportive'],
    ['dd_ss', 'd_ekonomi', 'primary'], ['dd_ss', 'd_risk', 'primary'], ['dd_ss', 'd_intern', 'primary'], ['dd_ss', 'd_data', 'primary'],
    ['dd_ss', 'd_infra', 'primary'], ['dd_ss', 'd_sec', 'primary'],
    ['dd_uf', 'd_produkt', 'primary'], ['dd_uf', 'd_integration', 'primary'], ['dd_uf', 'd_automation', 'primary']
  ];

  /* [id, namn, typ, systemkategori, status, IT-domän, beskrivning] */
  var SYSTEMS = [
    ['s_core', 'NPPension Core', 'Verksamhetssystem', 'system', 'production', 'd_penplat', 'Kärnsystem för pensionsadministration och kunddata.'],
    ['s_kundportal', 'Kundportal', 'Webbapplikation', 'system', 'production', 'd_digital', 'Webbportal för kunder och rådgivare.'],
    ['s_radgivarstod', 'Rådgivarstöd', 'Verksamhetssystem', 'system', 'production', 'd_digital', 'Stöd för rådgivare i kunddialog och behovsanalys.'],
    ['s_webb', 'Publik webb', 'Webbapplikation', 'system', 'production', 'd_digital', 'Publik webbplats med information och kampanjer.'],
    ['s_notif', 'Notifikationstjänst', 'Tjänst', 'service', 'production', 'd_digital', 'Utskick av sms, e-post och push till kunder.'],
    ['s_agportal', 'Arbetsgivarportal', 'Webbapplikation', 'system', 'production', 'd_digital', 'Portal där arbetsgivare rapporterar och ser fakturor.'],
    ['s_sapcrm', 'SAP CRM', 'Verksamhetssystem', 'system', 'production', 'd_crm', 'Kund- och avtalsdata för arbetsgivare.'],
    ['s_avtalsreg', 'Avtalsregister', 'Verksamhetssystem', 'system', 'development', 'd_crm', 'Nytt register för kollektivavtal och anslutningar.'],
    ['s_intplat', 'Integrationsplattform', 'Integrationsplattform', 'system', 'production', 'd_integration', 'Hanterar integrationer mellan interna och externa system.'],
    ['s_agapi', 'Arbetsgivar-API', 'Gränssnitt', 'interface', 'production', 'd_integration', 'API för löne- och händelserapportering från lönesystem.'],
    ['s_bi', 'BI-plattform', 'Analysplattform', 'system', 'production', 'd_data', 'Analys och rapportering för verksamheten.'],
    ['s_dwh', 'Datalager', 'Analysplattform', 'system', 'production', 'd_data', 'Historiserad data för analys och uppföljning.'],
    ['s_idp', 'Identitetstjänst', 'Infrastrukturtjänst', 'service', 'production', 'd_infra', 'Hantering av användare och behörigheter.'],
    ['s_monitor', 'Monitorering', 'Infrastrukturtjänst', 'service', 'production', 'd_infra', 'Övervakning och loggning av system och tjänster.'],
    ['s_testplat', 'Testplattform', 'Utvecklingsverktyg', 'service', 'production', 'd_infra', 'Miljö för test och kvalitetssäkring.'],
    ['s_dokument', 'Dokumenthantering', 'Verksamhetssystem', 'system', 'production', 'd_infra', 'Lagring och hantering av dokument.'],
    ['s_utbetmotor', 'Utbetalningsmotor', 'Verksamhetssystem', 'system', 'production', 'd_penplat', 'Beräknar och hanterar utbetalningar.'],
    ['s_betal', 'Betalningstjänst', 'Tjänst', 'service', 'production', 'd_penplat', 'Betalningar till och från bank.'],
    ['s_produktregler', 'Produktregelmotor', 'Funktion', 'function', 'development', 'd_penplat', 'Regler för produktvillkor enligt ITP 1 och ITP 2.'],
    ['s_kolbot', 'Kolbot RPA', 'Automationsplattform', 'system', 'production', 'd_automation', 'RPA-plattform som automatiserar administrativa flöden.']
  ];

  /* Kompetensmallar per roll: [kompetens eller 'stack'/'stack2'/'domain', lägsta nivå, högsta nivå, vikt] */
  var ROLE_TEMPLATES = {
    'Product Owner': [['c_po', 3, 4, 'primary'], ['c_ba', 2, 3, 'secondary'], ['domain', 2, 3, 'secondary']],
    'Tech Lead': [['stack', 3, 4, 'primary'], ['c_arch', 3, 4, 'secondary'], ['c_devops', 1, 2, 'secondary']],
    'Utvecklare': [['stack', 2, 4, 'primary'], ['stack2', 1, 3, 'secondary'], ['c_sql', 1, 3, 'secondary']],
    'Testare': [['c_test', 2, 4, 'primary'], ['c_testauto', 1, 3, 'secondary']],
    'Testautomatiserare': [['c_testauto', 3, 4, 'primary'], ['c_test', 2, 3, 'secondary'], ['c_python', 1, 2, 'secondary']],
    'UX-designer': [['c_ux', 2, 4, 'primary'], ['c_react', 1, 2, 'secondary']],
    'Kravanalytiker': [['c_req', 2, 4, 'primary'], ['domain', 2, 3, 'secondary'], ['c_ba', 1, 3, 'secondary']],
    'Systemadministratör': [['c_infra', 2, 4, 'primary'], ['c_devops', 1, 3, 'secondary']],
    'Dataanalytiker': [['c_data', 2, 4, 'primary'], ['c_sql', 2, 3, 'secondary']],
    'Data engineer': [['c_dataeng', 2, 4, 'primary'], ['c_python', 2, 3, 'secondary'], ['c_sql', 2, 4, 'secondary']],
    'Säkerhetsspecialist': [['c_sec', 2, 3, 'primary'], ['c_infra', 1, 3, 'secondary']],
    'Integrationsutvecklare': [['c_api', 2, 4, 'primary'], ['c_java', 1, 3, 'secondary']],
    'RPA-utvecklare': [['c_rpa', 2, 4, 'primary'], ['c_python', 1, 3, 'secondary'], ['c_penadm', 1, 2, 'secondary']],
    'Plattformsutvecklare': [['c_cloud', 2, 4, 'primary'], ['c_devops', 2, 3, 'secondary']],
    'SAP-utvecklare': [['c_abap', 2, 4, 'primary'], ['c_sapcrm', 2, 3, 'secondary']]
  };

  var FIRST = ['Johanna', 'Mattias', 'Elin', 'Daniel', 'Sofie', 'Niklas', 'Maja', 'Viktor', 'Ida', 'Andreas', 'Hanna', 'Robert', 'Linda', 'Fredrik', 'Amanda', 'Gustav', 'Klara', 'Marcus', 'Frida', 'Patrik', 'Josefin', 'Kristoffer', 'Malin', 'Simon', 'Therese', 'Joakim', 'Ebba', 'David', 'Nora', 'Rasmus', 'Tove', 'Samir', 'Leila', 'Mohammed', 'Yasmin', 'Dragan', 'Aida', 'Tomas', 'Wilma', 'Kevin', 'Elsa', 'Adam', 'Alva', 'Isak', 'Moa'];
  var LAST = ['Andersson', 'Johansson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson', 'Svensson', 'Gustafsson', 'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson', 'Jönsson', 'Lindberg', 'Jakobsson', 'Magnusson', 'Lindström', 'Axelsson', 'Berglund', 'Fredriksson', 'Sandberg', 'Henriksson', 'Forsberg', 'Sjögren', 'Lindgren', 'Engström', 'Danielsson', 'Håkansson', 'Hosseini', 'Yilmaz', 'Petrović', 'Ali', 'Karimi'];

  /*
   * Teamspecifikation. Medlemmar är antingen namngivna arbetare [workerId, roll, allokering, belastning]
   * eller genererade platser [roll, allokering].
   */
  var TEAMS = [
    {
      id: 't_kundportal', name: 'Kundportal Team', category: 'producing', bd: 'd_ks', it: 'd_digital',
      supportive: ['d_fm', 'd_produkt', 'd_integration', 'd_data'], stack: ['c_react', 'c_java'], domain: 'c_customer',
      description: 'Ett tvärfunktionellt team som utvecklar och förvaltar kundportalen och relaterade kundtjänsttjänster.',
      purpose: 'Utveckla, driva och kontinuerligt förbättra kundportalen för att ge våra kunder en enkel, säker och tillgänglig digital upplevelse.',
      systems: [['s_kundportal', 'owner'], ['s_notif', 'owner'], ['s_betal', 'contributor'], ['s_sapcrm', 'contributor']],
      lead: 'w_martin',
      named: [['w_martin', 'Product Manager', 100, 80], ['w_emma', 'Tech Lead', 100, 90], ['w_johan', 'Utvecklare', 100, 75], ['w_sara', 'Utvecklare', 100, 85],
        ['w_ali', 'Testare', 80, 60], ['w_lisa', 'UX-designer', 50, 50], ['w_erik', 'Systemadministratör', 50, 40], ['w_fatima', 'Business Analyst', 50, 70]]
    },
    {
      id: 't_radgivning', name: 'Rådgivning Team', category: 'producing', bd: 'd_ks', it: 'd_digital', supportive: ['d_fm'],
      stack: ['c_dotnet', 'c_react'], domain: 'c_customer',
      description: 'Utvecklar verktygen som rådgivare använder i kundmöten.',
      purpose: 'Ge rådgivarna ett stöd som gör varje kundmöte enklare och mer träffsäkert.',
      systems: [['s_radgivarstod', 'owner']],
      slots: [['Product Owner', 100], ['Tech Lead', 100], ['Utvecklare', 100], ['Utvecklare', 100], ['Testare', 100], ['Kravanalytiker', 50]]
    },
    {
      id: 't_webb', name: 'Webb & Kampanj Team', category: 'producing', bd: 'd_fm', it: 'd_digital', supportive: [],
      stack: ['c_react'], domain: 'c_customer', noLead: true,
      description: 'Förvaltar den publika webben och kampanjytor.',
      purpose: 'Göra det lätt att förstå och välja våra tjänster.',
      systems: [['s_webb', 'owner']],
      slots: [['Product Owner', 50], ['Utvecklare', 100], ['Utvecklare', 100], ['UX-designer', 50]]
    },
    {
      id: 't_pensionbackend', name: 'Pension Backend Team', category: 'producing', bd: 'd_penadm', it: 'd_penplat', supportive: ['d_utbet'],
      stack: ['c_java', 'c_sql'], domain: 'c_penadm',
      description: 'Utvecklar och förvaltar kärnsystemet för pensionsadministration.',
      purpose: 'Hålla kärnsystemet korrekt, stabilt och förberett för regelförändringar.',
      systems: [['s_core', 'owner'], ['s_utbetmotor', 'contributor']],
      slots: [['Product Owner', 100], ['Tech Lead', 100], ['Utvecklare', 100], ['Utvecklare', 100], ['Utvecklare', 100], ['Testare', 100], ['Kravanalytiker', 100]]
    },
    {
      id: 't_utbetalning', name: 'Utbetalning Team', category: 'producing', bd: 'd_utbet', it: 'd_penplat', supportive: ['d_integration'],
      stack: ['c_java'], domain: 'c_penadm',
      description: 'Ansvarar för utbetalningsflödet från beräkning till bank.',
      purpose: 'Rätt pension till rätt person i rätt tid.',
      systems: [['s_utbetmotor', 'owner'], ['s_betal', 'owner']],
      slots: [['Product Owner', 100], ['Utvecklare', 100], ['Utvecklare', 100], ['Testare', 50], ['Kravanalytiker', 50]]
    },
    {
      id: 't_forsakring', name: 'Försäkring & Produkt Team', category: 'producing', bd: 'd_penadm', it: 'd_data', supportive: ['d_produkt'],
      stack: ['c_python', 'c_sql'], domain: 'c_itp',
      description: 'Bygger produktregler och beräkningar för försäkringsprodukter.',
      purpose: 'Göra produktvillkoren maskinläsbara och spårbara.',
      systems: [['s_produktregler', 'owner']],
      slots: [['Product Owner', 100], ['Utvecklare', 100], ['Utvecklare', 100], ['Dataanalytiker', 100], ['Kravanalytiker', 100]]
    },
    {
      id: 't_sapcrm', name: 'SAP CRM backend Team', category: 'producing', bd: 'd_avtal', it: 'd_crm', supportive: ['d_premier'], loadBias: 25,
      stack: ['c_abap', 'c_sapcrm'], domain: 'c_itp',
      description: 'Utvecklar och förvaltar SAP CRM och avtalsregistret.',
      purpose: 'En korrekt och stabil bas för avtal och arbetsgivardata.',
      systems: [['s_sapcrm', 'owner'], ['s_avtalsreg', 'owner']],
      slots: [['Product Owner', 100], ['Tech Lead', 100], ['SAP-utvecklare', 100], ['SAP-utvecklare', 100], ['SAP-utvecklare', 100], ['Testare', 100], ['Kravanalytiker', 50]]
    },
    {
      id: 't_agportal', name: 'Arbetsgivarportal Team', category: 'producing', bd: 'd_rapport', it: 'd_digital', supportive: ['d_premier'],
      stack: ['c_react', 'c_dotnet'], domain: 'c_premium',
      description: 'Utvecklar portalen där arbetsgivare rapporterar och ser fakturor.',
      purpose: 'Göra rapporteringen enkel för arbetsgivare.',
      systems: [['s_agportal', 'owner']],
      named: [['w_lisa', 'UX-designer', 50, 65]],
      slots: [['Product Owner', 100], ['Utvecklare', 100], ['Utvecklare', 100], ['Utvecklare', 100], ['Testare', 100]]
    },
    {
      id: 't_api', name: 'API Team', category: 'supporting', bd: 'd_rapport', it: 'd_integration', supportive: ['d_avtal', 'd_premier'],
      stack: ['c_api', 'c_java'], domain: 'c_premium',
      description: 'Bygger och förvaltar API:er för arbetsgivarnas lönesystem.',
      purpose: 'Göra det möjligt för lönesystem att rapportera direkt.',
      systems: [['s_agapi', 'owner'], ['s_intplat', 'contributor']],
      slots: [['Tech Lead', 100], ['Integrationsutvecklare', 100], ['Integrationsutvecklare', 100], ['Testautomatiserare', 50]]
    },
    {
      id: 't_integration', name: 'Integration Team', category: 'supporting', bd: 'd_produkt', it: 'd_integration', supportive: ['d_penadm', 'd_utbet'],
      stack: ['c_api', 'c_java'], domain: 'c_penadm',
      description: 'Ansvarar för integrationsplattformen och gemensamma integrationer.',
      purpose: 'Göra integrationer snabba, säkra och återanvändbara.',
      systems: [['s_intplat', 'owner']],
      named: [['w_anna', 'Utvecklare', 100, 80], ['w_atlas', 'AI-assistent', 40, 100]],
      slots: [['Tech Lead', 100], ['Integrationsutvecklare', 100], ['Integrationsutvecklare', 100], ['Plattformsutvecklare', 50]]
    },
    {
      id: 't_data', name: 'Data & Analys Team', category: 'supporting', bd: 'd_ekonomi', it: 'd_data', supportive: ['d_risk'],
      stack: ['c_python', 'c_sql'], domain: 'c_finance',
      description: 'Bygger dataplattformen och analyser för hela organisationen.',
      purpose: 'Göra data tillgänglig och pålitlig för beslut.',
      systems: [['s_bi', 'owner'], ['s_dwh', 'owner']],
      named: [['w_fatima', 'Business Analyst', 50, 70]],
      slots: [['Product Owner', 100], ['Data engineer', 100], ['Data engineer', 100], ['Dataanalytiker', 100], ['Dataanalytiker', 100]]
    },
    {
      id: 't_infra', name: 'Infrastruktur Team', category: 'supporting', bd: 'd_intern', it: 'd_infra', supportive: ['d_sec'],
      stack: ['c_cloud', 'c_infra'], domain: 'c_process',
      description: 'Driftar och utvecklar den gemensamma plattformen.',
      purpose: 'Stabil, säker och kostnadseffektiv drift.',
      systems: [['s_idp', 'owner'], ['s_monitor', 'owner'], ['s_testplat', 'contributor'], ['s_dokument', 'contributor']],
      named: [['w_erik', 'Systemadministratör', 50, 70]],
      slots: [['Tech Lead', 100], ['Plattformsutvecklare', 100], ['Plattformsutvecklare', 100], ['Systemadministratör', 100], ['Systemadministratör', 100]]
    },
    {
      id: 't_sakerhet', name: 'Säkerhet Team', category: 'supporting', bd: 'd_risk', it: 'd_sec', supportive: ['d_infra'],
      stack: ['c_sec'], domain: 'c_legal',
      description: 'Säkerhetsarkitektur, åtkomsthantering och säkerhetsgranskning.',
      purpose: 'Skydda information och system mot hot.',
      systems: [['s_idp', 'contributor']],
      slots: [['Säkerhetsspecialist', 100], ['Säkerhetsspecialist', 100], ['Säkerhetsspecialist', 50]]
    },
    {
      id: 't_test', name: 'Test och Kvalitet Team', category: 'supporting', bd: 'd_produkt', it: 'd_digital', supportive: ['d_ks'],
      stack: ['c_testauto'], domain: 'c_customer',
      description: 'Gemensam testautomation och testmiljöer.',
      purpose: 'Snabbare leveranser med bibehållen kvalitet.',
      systems: [['s_testplat', 'owner']],
      named: [['w_ali', 'Testare', 20, 50]],
      slots: [['Testautomatiserare', 100], ['Testautomatiserare', 100], ['Testare', 100]]
    },
    {
      id: 't_ipa', name: 'IPA Team', category: 'producing', bd: 'd_penadm', it: 'd_automation', supportive: ['d_avtal', 'd_integration'],
      stack: ['c_rpa', 'c_python'], domain: 'c_itp',
      description: 'Intelligent processautomation med Kolbot och AI-agenter.',
      purpose: 'Frigöra tid i pensionsadministrationen genom automatisering av regelstyrda flöden.',
      systems: [['s_kolbot', 'owner']],
      named: [['w_atlas', 'AI-assistent', 60, 90]],
      slots: [['Product Owner', 100], ['RPA-utvecklare', 100], ['RPA-utvecklare', 100], ['RPA-utvecklare', 100], ['Kravanalytiker', 50]]
    }
  ];

  /* Namngivna arbetare: [id, namn, typ, konsult, grundkapacitet h/v, titel, kostnad/h, beskrivning, kompetenser] */
  var NAMED_WORKERS = [
    ['w_martin', 'Martin Karlsson', 'person', false, 40, 'Product Manager', 900, 'Ansvarar för kundportalens målbild och prioritering.', [['c_po', 4, 'primary'], ['c_ba', 3, 'secondary'], ['c_customer', 3, 'secondary']]],
    ['w_emma', 'Emma Sund', 'person', false, 40, 'Tech Lead', 950, 'Tekniskt ansvarig för kundportalen och arkitekt i Digitala kanaler.', [['c_arch', 4, 'primary'], ['c_react', 3, 'secondary'], ['c_java', 3, 'secondary']]],
    ['w_johan', 'Johan Lind', 'person', false, 40, 'Utvecklare', 800, 'Frontendutvecklare med fokus på tillgänglighet.', [['c_react', 3, 'primary'], ['c_ux', 2, 'secondary']]],
    ['w_sara', 'Sara Nilsson', 'person', false, 40, 'Utvecklare', 800, 'Backendutvecklare för kundportalens tjänster.', [['c_java', 3, 'primary'], ['c_api', 3, 'secondary']]],
    ['w_ali', 'Ali Khan', 'person', true, 40, 'Testare', 1150, 'Testledare och testautomatiserare.', [['c_test', 3, 'primary'], ['c_testauto', 3, 'secondary']]],
    ['w_lisa', 'Lisa Holm', 'person', false, 40, 'UX-designer', 820, 'UX-designer för kund- och arbetsgivarportalen.', [['c_ux', 4, 'primary']]],
    ['w_erik', 'Erik Ryd', 'person', false, 40, 'Systemadministratör', 780, 'Drift av portaler och plattform.', [['c_infra', 3, 'primary'], ['c_devops', 2, 'secondary']]],
    ['w_fatima', 'Fatima Nouri', 'person', true, 40, 'Business Analyst', 1200, 'Verksamhetsanalytiker med fokus på kunddata.', [['c_ba', 3, 'primary'], ['c_req', 3, 'secondary'], ['c_data', 2, 'secondary']]],
    ['w_anna', 'Anna Svensson', 'person', false, 40, 'Systemutvecklare', 850, 'Erfaren systemutvecklare med fokus på backend och integrationer inom pensionstjänster.', [['c_java', 4, 'primary'], ['c_api', 2, 'secondary'], ['c_sql', 2, 'secondary'], ['c_arch', 2, 'secondary'], ['c_devops', 1, 'secondary']]],
    ['w_atlas', 'Atlas', 'ai', false, 40, 'AI-assistent', 150, 'AI-agent som skriver kod, tester och integrationsmappningar under granskning av teamet.', [['c_ai', 3, 'primary'], ['c_testauto', 2, 'secondary'], ['c_api', 2, 'secondary']]],
    /* Domänmoln och nyckelroller utanför team */
    ['w_karin', 'Karin Ek', 'person', false, 40, 'Processexpert ITP', 880, 'Expert på ITP-regelverket och avtalsprocesserna.', [['c_itp', 4, 'primary'], ['c_process', 3, 'secondary']]],
    ['w_per', 'Per Olsson', 'person', true, 40, 'Systemspecialist SAP CRM', 1350, 'Systemspecialist med djup kunskap om SAP CRM-lösningen.', [['c_sapcrm', 4, 'primary'], ['c_abap', 3, 'secondary']]],
    ['w_maria', 'Maria Berg', 'person', false, 40, 'Verksamhetsarkitekt', 920, 'Verksamhetsarkitekt för kundservice.', [['c_bizarch', 4, 'primary'], ['c_process', 3, 'secondary']]],
    ['w_jonas', 'Jonas Wik', 'person', false, 32, 'Jurist', 950, 'Jurist med ansvar för dataskydd och avtal.', [['c_legal', 4, 'primary']]],
    ['w_eva', 'Eva Lund', 'person', false, 40, 'Kravanalytiker', 820, 'Kravanalytiker för arbetsgivarrapportering.', [['c_req', 3, 'primary'], ['c_itp', 3, 'secondary']]],
    ['w_oskar', 'Oskar Hedlund', 'person', false, 40, 'Premieexpert', 840, 'Expert på premieberäkning och fakturering.', [['c_premium', 4, 'primary']]],
    ['w_linnea', 'Linnea Falk', 'person', false, 40, 'Pensionsexpert', 860, 'Pensionsexpert med lång erfarenhet av ITP-administration.', [['c_penadm', 4, 'primary'], ['c_itp', 4, 'secondary']]],
    ['w_henrik', 'Henrik Sjöberg', 'person', true, 40, 'Integrationsarkitekt', 1400, 'Arkitekt för integrationsplattformen.', [['c_arch', 4, 'primary'], ['c_api', 4, 'secondary']]],
    ['w_helena', 'Helena Strand', 'person', false, 40, 'Projektledare', 900, 'Projektledare för avtalsregisterinitiativet.', [['c_pm', 4, 'primary'], ['c_change', 3, 'secondary']]],
    ['w_mikael', 'Mikael Öberg', 'person', false, 40, 'Leveransdomänarkitekt', 950, 'Arkitekt för pensionsplattformen.', [['c_bizarch', 3, 'primary'], ['c_arch', 3, 'primary']]],
    ['w_cecilia', 'Cecilia Norén', 'person', false, 40, 'Leveransdomänägare', 1000, 'Äger prioriteringen inom Kund och Marknad.', [['c_po', 4, 'primary'], ['c_customer', 3, 'secondary']]],
    ['w_thomas', 'Thomas Ahlgren', 'person', false, 40, 'Leveransdomänägare', 1000, 'Äger prioriteringen inom Pension och Utbetalning.', [['c_po', 3, 'primary'], ['c_penadm', 4, 'secondary']]],
    ['w_sofia', 'Sofia Lindqvist', 'person', false, 40, 'Leveransdomänägare', 1000, 'Äger prioriteringen inom Arbetsgivarstöd.', [['c_po', 4, 'primary'], ['c_premium', 3, 'secondary']]],
    ['w_anders', 'Anders Holm', 'person', false, 40, 'Leveransdomänägare', 1000, 'Äger prioriteringen inom Stöd och Styrning.', [['c_po', 3, 'primary'], ['c_finance', 3, 'secondary']]],
    ['w_petra', 'Petra Wallin', 'person', false, 40, 'Leveransdomänägare', 1000, 'Äger prioriteringen inom Utveckling och Förändring.', [['c_po', 4, 'primary'], ['c_change', 3, 'secondary']]],
    ['w_robin', 'Robin Ek', 'person', false, 40, 'Systemutvecklare', 800, 'Nyanställd, ännu inte placerad i team.', [['c_java', 2, 'primary']]]
  ];

  /* Domänmoln (ExtendedDomain_Competence): [arbetare, domän, roll, h/mån, från, till] */
  var DOMAIN_EXPERTS = [
    ['w_karin', 'd_avtal', 'Processexpert', 60, '2026-01-01', '2026-12-31'],
    ['w_karin', 'd_rapport', 'Regelexpert', 30, '2026-09-01', '2026-11-30'],
    ['w_per', 'd_crm', 'Systemspecialist', 80, '2026-01-01', '2027-06-30'],
    ['w_maria', 'd_ks', 'Verksamhetsarkitekt', 40, '2026-01-01', '2026-12-31'],
    ['w_jonas', 'd_risk', 'Jurist', 30, '2026-01-01', '2026-12-31'],
    ['w_eva', 'd_rapport', 'Kravanalytiker', 100, '2026-06-01', '2026-12-31'],
    ['w_oskar', 'd_premier', 'Premieexpert', 60, '2026-01-01', '2026-12-31'],
    ['w_linnea', 'd_penadm', 'Pensionsexpert', 80, '2026-01-01', '2026-12-31'],
    ['w_henrik', 'd_integration', 'Integrationsarkitekt', 60, '2026-01-01', '2026-12-31'],
    ['w_emma', 'd_digital', 'Arkitekt', 24, '2026-09-01', '2026-12-31']
  ];

  /* Nyckelroller på leveransdomännivå (ExtendedDeliveryCompetence) */
  var DELIVERY_EXPERTS = [
    ['w_helena', 'dd_ag', 'Projektledare', 120, '2026-08-01', '2027-03-31'],
    ['w_mikael', 'dd_pu', 'Leveransdomänarkitekt', 60, '2026-01-01', '2026-12-31'],
    ['w_cecilia', 'dd_km', 'Leveransdomänägare', 30, '2026-01-01', '2026-12-31'],
    ['w_thomas', 'dd_pu', 'Leveransdomänägare', 30, '2026-01-01', '2026-12-31'],
    ['w_sofia', 'dd_ag', 'Leveransdomänägare', 30, '2026-01-01', '2026-12-31'],
    ['w_anders', 'dd_ss', 'Leveransdomänägare', 20, '2026-01-01', '2026-12-31'],
    ['w_petra', 'dd_uf', 'Leveransdomänägare', 30, '2026-01-01', '2026-12-31']
  ];

  var OWNERS = {
    dd_km: 'w_cecilia', dd_pu: 'w_thomas', dd_ag: 'w_sofia', dd_ss: 'w_anders', dd_uf: 'w_petra',
    d_ks: 'w_maria', d_fm: 'w_cecilia', d_penadm: 'w_linnea', d_utbet: 'w_thomas', d_avtal: 'w_karin', d_rapport: 'w_eva',
    d_ekonomi: 'w_anders', d_risk: 'w_jonas', d_intern: 'w_anders', d_produkt: 'w_petra',
    d_digital: 'w_emma', d_crm: 'w_per', d_integration: 'w_henrik', d_infra: 'w_erik', d_penplat: 'w_mikael'
  };

  /*
   * Epiker som tidigare låg i demodatan men som nu ingår i teamets förvaltning: utbildning,
   * införanden och uppgraderingar. Sparad data uppdateras så att de inte ligger kvar som egna epiker.
   */
  var RETIRED_EPICS = [
    ['t_kundportal', 'Utbildning i tillgänglighet (WCAG 2.2)'],
    ['t_agportal', 'Utbildning i tillgänglighet (WCAG 2.2)'],
    ['t_test', 'Utbildning i det nya testverktyget'],
    ['t_kundportal', 'Utbildning i nytt CMS'],
    ['t_infra', 'Uppgradering av infrastruktur'],
    ['t_sakerhet', 'Säkerhetsutbildning (ISO 27001)'],
    ['t_test', 'Införande av nytt testverktyg']
  ];

  /* Teamavdrag är tid som inte finns: frånvaro. Arbete ligger som epiker, så att inget räknas två gånger. */
  var TEAM_REDUCTIONS = [
    ['t_forsakring', 'Föräldraledighet', 20, '2026-09-01', '2026-12-31', 'Två medarbetare på föräldraledighet'],
    ['t_integration', 'Frånvaro', 10, '2026-09-01', '2026-09-30', 'Långtidsfrånvaro']
  ];

  /*
   * Avdrag som tidigare låg i demodatan men som är arbete. Sparad data uppdateras: avdraget tas bort.
   * Arbetet ryms i teamets förvaltning eller i en epik som redan finns.
   */
  var RETIRED_REDUCTIONS = [
    { teamId: 't_kundportal', type: 'Utbildning', comment: 'Utbildning i nytt CMS', epic: null },
    { teamId: 't_data', type: 'Systembyte', comment: 'Migrering till ny dataplattform', epic: null },
    { teamId: 't_infra', type: 'Planerat underhåll', comment: 'Uppgradering av infrastruktur', epic: null },
    { teamId: 't_sakerhet', type: 'Utbildning', comment: 'Säkerhetsutbildning (ISO 27001)', epic: null },
    { teamId: 't_test', type: 'Verktygsinförande', comment: 'Införande av nytt testverktyg', epic: null }
  ];

  /*
   * Arbete. Initiativ är beslutade satsningar som en leveransdomän äger. Epiker är teamens arbete:
   * utveckling (ofta nedbrutet från ett initiativ), förvaltning och utredning. Varje team har en
   * förvaltningsepik. Den rymmer drift, rättningar, utbildning och kompetensspridning.
   * Omvänd estimering (problem 17): leveransdomänen beslutar hur mycket tid ett initiativ får kosta
   * (investeringen, sista fältet). Teamen estimerar sina epiker. Ett förslag är teamets estimat, och när
   * epiken beslutas blir estimatet dess ram. Självservice ryms inte om förslaget beslutas, ITP 1 går
   * redan över och Dataplattformen saknar beslutad investering.
   * monthly = timmar per månad så länge epiken pågår, total = timmar fördelade jämnt över arbetsdagarna.
   */
  var INITIATIVES = [
    ['in_sjalvservice', 'Självservice för pensionssparare', 'dd_km', 'w_cecilia', 'active', '2026-09-01', '2027-03-31',
      'Hälften av kundernas ärenden ska gå att lösa själv i kundportalen.', 3000],
    ['in_itp1', 'Ny utbetalningsmotor för ITP 1', 'dd_pu', 'w_thomas', 'active', '2026-08-01', '2027-03-31',
      'Utbetalningar enligt ITP 1 ska hanteras i den nya motorn utan manuella steg.', 6000],
    ['in_kolbot', 'Automatiserad pensionsadministration', 'dd_pu', 'w_linnea', 'active', '2026-09-01', '2027-02-28',
      'Minska den manuella hanteringen av avtalsändringar med 40 procent med hjälp av Kolbot.', 2400],
    ['in_anslutning', 'Digital anslutning av arbetsgivare', 'dd_ag', 'w_helena', 'active', '2026-08-01', '2027-03-31',
      'Arbetsgivare ska kunna ansluta sig, teckna avtal och rapportera helt digitalt.', 7000],
    ['in_dora', 'DORA och digital motståndskraft', 'dd_ss', 'w_anders', 'active', '2026-06-01', '2026-12-31',
      'Uppfylla kraven i DORA innan tillsynen i januari 2027.', 800],
    ['in_dataplattform', 'Dataplattform i molnet', 'dd_uf', 'w_petra', 'active', '2026-09-01', '2027-04-30',
      'Flytta datalager och BI till en gemensam plattform i molnet och avveckla den lokala miljön.', null]
  ];

  /* [team, namn, typ, initiativ, status, ram, timmar, från, till, beskrivning] */
  var EPICS = [
    ['t_kundportal', 'Förvaltning av kundportalen', 'maintenance', null, 'active', 'monthly', 200, '2026-01-01', '2027-12-31', 'Rättningar, mindre förbättringar och uppgraderingar av kundportalen och notifikationstjänsten.'],
    ['t_kundportal', 'Självservice: byta förmånstagare', 'development', 'in_sjalvservice', 'active', 'total', 1100, '2026-09-01', '2026-12-31', 'Kunden ska kunna byta förmånstagare själv, med signering och kvittens.'],
    ['t_kundportal', 'Chattbot för vanliga frågor', 'development', 'in_sjalvservice', 'proposed', 'total', 600, '2026-11-01', '2027-01-31', 'Förslag: en chattbot som svarar på de tjugo vanligaste frågorna.'],
    ['t_radgivning', 'Förvaltning av rådgivarstödet', 'maintenance', null, 'active', 'monthly', 180, '2026-01-01', '2027-12-31', 'Löpande förvaltning av verktygen som rådgivarna använder.'],
    ['t_radgivning', 'Digitalt rådgivningsmöte', 'development', 'in_sjalvservice', 'active', 'total', 1500, '2026-09-01', '2027-02-28', 'Kunden ska kunna boka och genomföra rådgivning på distans med delad skärm.'],
    ['t_radgivning', 'Utredning: AI-stöd i rådgivning', 'investigation', null, 'active', 'total', 240, '2026-09-14', '2026-11-30', 'Vad kan ett AI-stöd göra i kundmötet, och vilka risker finns?'],
    ['t_webb', 'Förvaltning av publika webben', 'maintenance', null, 'active', 'monthly', 120, '2026-01-01', '2027-12-31', 'Innehåll, tillgänglighet och teknisk förvaltning av webben.'],
    ['t_webb', 'Kampanj: Pensionsveckan 2026', 'development', null, 'active', 'total', 280, '2026-09-15', '2026-11-13', 'Kampanjsidor och mätning inför Pensionsveckan.'],
    ['t_pensionbackend', 'Förvaltning av NPPension Core', 'maintenance', null, 'active', 'monthly', 300, '2026-01-01', '2027-12-31', 'Drift, rättningar och regeländringar i kärnsystemet.'],
    ['t_pensionbackend', 'ITP 1: regelmotor för utbetalning', 'development', 'in_itp1', 'active', 'total', 2800, '2026-08-03', '2027-03-31', 'Utbetalningsreglerna för ITP 1 flyttas till den nya regelmotorn.'],
    ['t_pensionbackend', 'Utredning: avveckling av nattbatchen', 'investigation', null, 'active', 'total', 160, '2026-09-14', '2026-11-30', 'Kan den gamla nattbatchen avvecklas när regelmotorn är på plats?'],
    ['t_utbetalning', 'Förvaltning av utbetalningsmotorn', 'maintenance', null, 'active', 'monthly', 160, '2026-01-01', '2027-12-31', 'Löpande förvaltning av utbetalningsmotorn och betalfilerna.'],
    ['t_utbetalning', 'ITP 1: ny utbetalningsmotor', 'development', 'in_itp1', 'active', 'total', 1300, '2026-09-01', '2027-03-31', 'Den nya motorn byggs och kopplas till regelmotorn och banken.'],
    ['t_forsakring', 'Förvaltning av produktregelmotorn', 'maintenance', null, 'active', 'monthly', 150, '2026-01-01', '2027-12-31', 'Regeländringar och förvaltning av produktregelmotorn.'],
    ['t_forsakring', 'Nya produktvillkor ITP 2 2027', 'development', null, 'active', 'total', 900, '2026-09-01', '2026-12-31', 'Villkoren som gäller från januari 2027 ska finnas i produktregelmotorn.'],
    ['t_sapcrm', 'Förvaltning av SAP CRM', 'maintenance', null, 'active', 'monthly', 320, '2026-01-01', '2027-12-31', 'Rättningar, behörigheter och små förändringar i SAP CRM.'],
    ['t_sapcrm', 'Avtalsregistret: ny version', 'development', 'in_anslutning', 'active', 'total', 2000, '2026-08-03', '2027-01-29', 'Nytt avtalsregister för kollektivavtal och anslutningar.'],
    ['t_sapcrm', 'Förstudie: uppgradering till S/4', 'investigation', null, 'active', 'total', 300, '2026-09-14', '2026-11-30', 'Vad kostar en uppgradering till S/4HANA och när behöver den göras?'],
    ['t_agportal', 'Förvaltning av arbetsgivarportalen', 'maintenance', null, 'active', 'monthly', 160, '2026-01-01', '2027-12-31', 'Löpande förvaltning av arbetsgivarportalen.'],
    ['t_agportal', 'Digital anslutning: nytt onboardingflöde', 'development', 'in_anslutning', 'active', 'total', 2400, '2026-08-03', '2027-03-31', 'Arbetsgivaren ansluter sig och tecknar avtal i ett sammanhängande flöde.'],
    ['t_api', 'Förvaltning av Arbetsgivar-API', 'maintenance', null, 'active', 'monthly', 120, '2026-01-01', '2027-12-31', 'Förvaltning och övervakning av API:et.'],
    ['t_api', 'Rapportering via API för lönesystem', 'development', 'in_anslutning', 'active', 'total', 1350, '2026-09-01', '2027-01-29', 'Lönesystem ska kunna rapportera direkt utan filöverföring.'],
    ['t_integration', 'Förvaltning av integrationsplattformen', 'maintenance', null, 'active', 'monthly', 260, '2026-01-01', '2027-12-31', 'Drift och förvaltning av integrationsplattformen.'],
    ['t_integration', 'Integrationer för ITP 1', 'development', 'in_itp1', 'active', 'total', 1200, '2026-09-01', '2027-01-29', 'Flöden mellan regelmotor, utbetalningsmotor och bank.'],
    ['t_integration', 'Integrationer för digital anslutning', 'development', 'in_anslutning', 'planned', 'total', 300, '2026-10-01', '2026-12-31', 'Flöden mellan arbetsgivarportalen, avtalsregistret och SAP CRM.'],
    ['t_data', 'Förvaltning av BI och datalager', 'maintenance', null, 'active', 'monthly', 200, '2026-01-01', '2027-12-31', 'Rapporter, laddningar och datakvalitet.'],
    ['t_data', 'Dataplattform: migrering av datalagret', 'development', 'in_dataplattform', 'active', 'total', 2200, '2026-09-01', '2027-04-30', 'Datalagret flyttas till den nya plattformen, ämnesområde för ämnesområde.'],
    ['t_infra', 'Förvaltning av infrastrukturen', 'maintenance', null, 'active', 'monthly', 300, '2026-01-01', '2027-12-31', 'Drift, patchning och kapacitet i infrastrukturen.'],
    ['t_infra', 'Dataplattform: landningszon i molnet', 'development', 'in_dataplattform', 'active', 'total', 900, '2026-09-01', '2026-12-31', 'Nätverk, behörigheter och övervakning för den nya plattformen.'],
    ['t_sakerhet', 'Förvaltning av säkerhetstjänster', 'maintenance', null, 'active', 'monthly', 90, '2026-01-01', '2027-12-31', 'Identitetstjänst, loggning och sårbarhetshantering.'],
    ['t_sakerhet', 'DORA: incidentrapportering', 'development', 'in_dora', 'active', 'total', 500, '2026-06-01', '2026-12-31', 'Rutin och stöd för att rapportera större incidenter till tillsynen.'],
    ['t_sakerhet', 'DORA: register över tredjepartsleverantörer', 'investigation', 'in_dora', 'active', 'total', 160, '2026-09-14', '2026-11-30', 'Kartläggning av alla IT-leverantörer och deras kritikalitet.'],
    ['t_test', 'Förvaltning av testmiljöerna', 'maintenance', null, 'active', 'monthly', 110, '2026-01-01', '2027-12-31', 'Testmiljöer, testdata och verktyg.'],
    ['t_test', 'Testautomation för ITP 1', 'development', 'in_itp1', 'active', 'total', 700, '2026-09-01', '2027-01-29', 'Automatiserade regressionstester för hela utbetalningskedjan.'],
    ['t_ipa', 'Förvaltning av Kolbot RPA', 'maintenance', null, 'active', 'monthly', 220, '2026-01-01', '2027-12-31', 'Övervakning, rättningar och nya versioner av robotarna.'],
    ['t_ipa', 'Kolbot: automatiserade avtalsändringar', 'development', 'in_kolbot', 'active', 'total', 1600, '2026-09-01', '2027-02-26', 'Robotar som hanterar de vanligaste avtalsändringarna utan manuellt steg.'],
    ['t_ipa', 'Kolbot: robotar för ITP 1-utbetalningar', 'development', 'in_itp1', 'planned', 'total', 500, '2026-11-02', '2027-03-31', 'Robotar för de undantag som den nya motorn inte hanterar.'],
    ['t_ipa', 'Utredning: AI-agenter i Kolbot', 'investigation', null, 'active', 'total', 160, '2026-09-14', '2026-11-30', 'Kan AI-agenter ta över ärenden där robotarna i dag stannar?']
  ];

  /*
   * Kompetensbehov per epik: hur epikens timmar fördelas på kompetensområden, i procent.
   * En epik utan behov fördelas som teamets sammansättning. Behoven gör flaskhalsar synliga:
   * ett team kan ha tid hos utvecklarna men inte i test eller krav.
   */
  var NEEDS = {
    'Självservice: byta förmånstagare': [['Utveckling', 45], ['Test & QA', 20], ['Analys', 15], ['Design', 10], ['Ledning', 10]],
    'Förvaltning av kundportalen': [['Utveckling', 40], ['Test & QA', 20], ['Drift & Infrastruktur', 25], ['Ledning', 10], ['Arkitektur', 5]],
    'Chattbot för vanliga frågor': [['Utveckling', 50], ['Test & QA', 20], ['Analys', 20], ['Design', 10]],
    'Digitalt rådgivningsmöte': [['Utveckling', 55], ['Test & QA', 20], ['Analys', 15], ['Ledning', 10]],
    'Förvaltning av rådgivarstödet': [['Utveckling', 60], ['Test & QA', 25], ['Ledning', 15]],
    'Utredning: AI-stöd i rådgivning': [['Analys', 50], ['Utveckling', 30], ['Ledning', 20]],
    'Kampanj: Pensionsveckan 2026': [['Utveckling', 60], ['Design', 30], ['Ledning', 10]],
    'Förvaltning av publika webben': [['Utveckling', 80], ['Design', 10], ['Ledning', 10]],
    'ITP 1: regelmotor för utbetalning': [['Utveckling', 55], ['Analys', 20], ['Test & QA', 15], ['Ledning', 10]],
    'Förvaltning av NPPension Core': [['Utveckling', 60], ['Test & QA', 20], ['Analys', 10], ['Ledning', 10]],
    'Utredning: avveckling av nattbatchen': [['Analys', 40], ['Utveckling', 40], ['Ledning', 20]],
    'ITP 1: ny utbetalningsmotor': [['Utveckling', 55], ['Test & QA', 25], ['Analys', 10], ['Ledning', 10]],
    'Förvaltning av utbetalningsmotorn': [['Utveckling', 60], ['Test & QA', 25], ['Ledning', 15]],
    'Nya produktvillkor ITP 2 2027': [['Analys', 30], ['Utveckling', 40], ['Data & Analys', 20], ['Ledning', 10]],
    'Förvaltning av produktregelmotorn': [['Utveckling', 60], ['Data & Analys', 25], ['Ledning', 15]],
    'Avtalsregistret: ny version': [['Utveckling', 60], ['Test & QA', 20], ['Analys', 10], ['Ledning', 10]],
    'Förvaltning av SAP CRM': [['Utveckling', 65], ['Test & QA', 20], ['Ledning', 15]],
    'Förstudie: uppgradering till S/4': [['Analys', 25], ['Utveckling', 45], ['Ledning', 30]],
    'Digital anslutning: nytt onboardingflöde': [['Utveckling', 55], ['Test & QA', 20], ['Design', 15], ['Ledning', 10]],
    'Förvaltning av arbetsgivarportalen': [['Utveckling', 65], ['Test & QA', 25], ['Ledning', 10]],
    'Rapportering via API för lönesystem': [['Integration', 85], ['Test & QA', 15]],
    'Förvaltning av Arbetsgivar-API': [['Integration', 80], ['Test & QA', 20]],
    'Förvaltning av integrationsplattformen': [['Integration', 60], ['Drift & Infrastruktur', 20], ['Utveckling', 20]],
    'Integrationer för ITP 1': [['Integration', 70], ['Utveckling', 20], ['Test & QA', 10]],
    'Integrationer för digital anslutning': [['Integration', 70], ['Utveckling', 30]],
    'Dataplattform: migrering av datalagret': [['Data & Analys', 80], ['Analys', 10], ['Ledning', 10]],
    'Förvaltning av BI och datalager': [['Data & Analys', 85], ['Ledning', 15]],
    'Kolbot: automatiserade avtalsändringar': [['Automation', 70], ['Analys', 20], ['Ledning', 10]],
    'Förvaltning av Kolbot RPA': [['Automation', 85], ['Ledning', 15]],
    'Utredning: AI-agenter i Kolbot': [['Automation', 50], ['Analys', 30], ['Ledning', 20]],
    'Kolbot: robotar för ITP 1-utbetalningar': [['Automation', 70], ['Analys', 20], ['Ledning', 10]]
  };

  /* Beroenden: [epik, epik som måste leverera först]. */
  var DEPENDENCIES = [
    ['ITP 1: ny utbetalningsmotor', 'ITP 1: regelmotor för utbetalning'],
    ['Integrationer för ITP 1', 'ITP 1: ny utbetalningsmotor'],
    ['Testautomation för ITP 1', 'Integrationer för ITP 1'],
    ['Kolbot: robotar för ITP 1-utbetalningar', 'ITP 1: ny utbetalningsmotor'],
    ['Digital anslutning: nytt onboardingflöde', 'Integrationer för digital anslutning'],
    ['Dataplattform: migrering av datalagret', 'Dataplattform: landningszon i molnet'],
    ['Chattbot för vanliga frågor', 'Självservice: byta förmånstagare'],
    ['DORA: incidentrapportering', 'DORA: register över tredjepartsleverantörer']
  ];

  function build() {
    var rnd = U.prng(20260904);
    function pick(arr) { return arr[Math.floor(rnd() * arr.length)]; }
    function between(a, b) { return a + Math.floor(rnd() * (b - a + 1)); }

    var db = {
      meta: { version: 1, seededAt: '2026-09-04' },
      settings: { orgName: 'Nordpension', standardWeekHours: 40, periodType: 'pi', periodAnchor: null, loadSource: 'epics' },
      overheadReductions: [
        { id: 'oh_semester', name: 'Semester', hoursPerWeek: 4, appliesToAI: false },
        { id: 'oh_kompetens', name: 'Kompetensutveckling', hoursPerWeek: 2, appliesToAI: false },
        { id: 'oh_moten', name: 'Interna möten', hoursPerWeek: 2, appliesToAI: false },
        { id: 'oh_admin', name: 'Administration', hoursPerWeek: 1, appliesToAI: false }
      ],
      teamReductions: [],
      /* PI-kalendern. Demodatan har en PI per kalenderkvartal. Den går att ändra under Kapacitet. */
      pis: quarterPIs(2025, 2028),
      initiatives: [],
      epics: [],
      deliveryDomains: [],
      domains: [],
      domainClusters: [],
      teams: [],
      teamDomains: [],
      workers: [],
      teamWorkers: [],
      competences: [],
      workerCompetences: [],
      extendedDomainCompetences: [],
      extendedDeliveryCompetences: [],
      systems: [],
      teamSystems: [],
      itDomainSystems: []
    };

    var n = 0;
    function id(prefix) { n++; return prefix + '_' + n.toString(36); }

    COMPETENCES.forEach(function (c) {
      db.competences.push({ id: c[0], name: c[1], type: c[2], category: c[3], description: c[4], details: '' });
    });
    DELIVERY_DOMAINS.forEach(function (d) {
      db.deliveryDomains.push({ id: d[0], name: d[1], primaryObjective: d[2], description: d[3], purpose: d[4], ownerId: OWNERS[d[0]] || null, status: 'active', updated: '2026-09-18' });
    });
    DOMAINS.forEach(function (d) {
      db.domains.push({ id: d[0], name: d[1], type: d[2], description: d[3], purpose: d[4], ownerId: OWNERS[d[0]] || null, status: 'active', updated: '2026-09-18' });
    });
    CLUSTERS.forEach(function (c) {
      db.domainClusters.push({ id: id('dc'), deliveryDomainId: c[0], domainId: c[1], relationship: c[2] });
    });
    SYSTEMS.forEach(function (s) {
      db.systems.push({ id: s[0], name: s[1], kind: s[2], category: s[3], status: s[4], description: s[6] });
      db.itDomainSystems.push({ id: id('ids'), domainId: s[5], systemId: s[0], relationship: 'primary' });
    });
    db.itDomainSystems.push({ id: id('ids'), domainId: 'd_integration', systemId: 's_betal', relationship: 'supportive' });
    db.itDomainSystems.push({ id: id('ids'), domainId: 'd_sec', systemId: 's_idp', relationship: 'supportive' });

    NAMED_WORKERS.forEach(function (w) {
      db.workers.push({ id: w[0], name: w[1], type: w[2], consultant: w[3], baseHoursPerWeek: w[4], title: w[5], costPerHour: w[6], description: w[7], status: 'active' });
      w[8].forEach(function (c) {
        db.workerCompetences.push({ id: id('wc'), workerId: w[0], competenceId: c[0], level: c[1], weight: c[2] });
      });
    });

    var usedNames = new Set(db.workers.map(function (w) { return w.name; }));
    function newName() {
      for (var i = 0; i < 500; i++) {
        var name = pick(FIRST) + ' ' + pick(LAST);
        if (!usedNames.has(name)) { usedNames.add(name); return name; }
      }
      return 'Arbetare ' + usedNames.size;
    }

    function resolveComp(key, team) {
      if (key === 'stack') return team.stack[0];
      if (key === 'stack2') return team.stack[1] || team.stack[0];
      if (key === 'domain') return team.domain;
      return key;
    }

    TEAMS.forEach(function (t) {
      db.teams.push({ id: t.id, name: t.name, category: t.category, description: t.description, purpose: t.purpose, leadId: null, status: 'active' });
      db.teamDomains.push({ id: id('td'), teamId: t.id, domainId: t.bd, relationship: 'primary' });
      db.teamDomains.push({ id: id('td'), teamId: t.id, domainId: t.it, relationship: 'primary' });
      t.supportive.forEach(function (d) {
        db.teamDomains.push({ id: id('td'), teamId: t.id, domainId: d, relationship: 'supportive' });
      });
      t.systems.forEach(function (s) {
        db.teamSystems.push({ id: id('ts'), teamId: t.id, systemId: s[0], objective: s[1] });
      });
      var memberIds = [];
      (t.named || []).forEach(function (m) {
        db.teamWorkers.push({ id: id('tw'), teamId: t.id, workerId: m[0], role: m[1], allocation: m[2], plannedLoad: m[3] });
        memberIds.push({ id: m[0], role: m[1] });
      });
      (t.slots || []).forEach(function (slot) {
        var role = slot[0];
        var consultant = rnd() < 0.2;
        var wid = id('w');
        var partTime = rnd() < 0.1;
        db.workers.push({
          id: wid,
          name: newName(),
          type: 'person',
          consultant: consultant,
          baseHoursPerWeek: partTime ? 32 : 40,
          title: role,
          costPerHour: consultant ? between(11, 14) * 100 : between(7, 9) * 100 + 50,
          description: role + ' i ' + t.name + '.',
          status: 'active'
        });
        var seen = new Set();
        (ROLE_TEMPLATES[role] || []).forEach(function (tpl) {
          var cid = resolveComp(tpl[0], t);
          if (!cid || seen.has(cid)) return;
          seen.add(cid);
          db.workerCompetences.push({ id: id('wc'), workerId: wid, competenceId: cid, level: between(tpl[1], tpl[2]), weight: tpl[3] });
        });
        var load = Math.min(100, (slot[1] === 100 ? between(12, 19) * 5 : between(8, 16) * 5) + (t.loadBias || 0));
        db.teamWorkers.push({ id: id('tw'), teamId: t.id, workerId: wid, role: role, allocation: slot[1], plannedLoad: load });
        memberIds.push({ id: wid, role: role });
      });
      var team = db.teams[db.teams.length - 1];
      if (t.lead) team.leadId = t.lead;
      else if (!t.noLead) {
        var lead = memberIds.filter(function (m) { return m.role === 'Product Owner' || m.role === 'Tech Lead'; })[0] || memberIds[0];
        team.leadId = lead ? lead.id : null;
      }
    });

    /* Ägare för IT-domäner som bara finns i genererade team. */
    function leadOf(teamId) {
      var t = db.teams.filter(function (x) { return x.id === teamId; })[0];
      return t ? t.leadId : null;
    }
    db.domains.forEach(function (d) {
      if (d.ownerId) return;
      if (d.id === 'd_data') d.ownerId = leadOf('t_data');
      if (d.id === 'd_sec') d.ownerId = leadOf('t_sakerhet');
      if (d.id === 'd_automation') d.ownerId = leadOf('t_ipa');
    });

    DOMAIN_EXPERTS.forEach(function (x) {
      db.extendedDomainCompetences.push({ id: id('edc'), workerId: x[0], domainId: x[1], role: x[2], hoursPerMonth: x[3], from: x[4], to: x[5] });
    });
    DELIVERY_EXPERTS.forEach(function (x) {
      db.extendedDeliveryCompetences.push({ id: id('ddc'), workerId: x[0], deliveryDomainId: x[1], role: x[2], hoursPerMonth: x[3], from: x[4], to: x[5] });
    });
    TEAM_REDUCTIONS.forEach(function (r) {
      db.teamReductions.push({ id: id('tr'), teamId: r[0], type: r[1], percent: r[2], from: r[3], to: r[4], comment: r[5] });
    });
    INITIATIVES.forEach(function (x) {
      db.initiatives.push({ id: x[0], name: x[1], deliveryDomainId: x[2], ownerId: x[3], status: x[4], from: x[5], to: x[6], goal: x[7], investment: x[8] });
    });
    EPICS.forEach(function (x, i) {
      db.epics.push({
        id: 'ep_' + (i + 1), teamId: x[0], name: x[1], type: x[2], initiativeId: x[3], status: x[4],
        effort: x[5], hours: x[6], from: x[7], to: x[8], description: x[9],
        needs: (NEEDS[x[1]] || []).map(function (n) { return { category: n[0], share: n[1] }; }),
        dependsOn: []
      });
    });
    var byName = {};
    db.epics.forEach(function (ep) { byName[ep.name] = ep; });
    DEPENDENCIES.forEach(function (d) {
      if (byName[d[0]] && byName[d[1]]) byName[d[0]].dependsOn.push(byName[d[1]].id);
    });

    return db;
  }

  /* En PI per kalenderkvartal: PI 1 är januari–mars. */
  function quarterPIs(fromYear, toYear) {
    var out = [];
    for (var y = fromYear; y <= toYear; y++) {
      for (var q = 0; q < 4; q++) {
        out.push({ id: 'pi_' + y + '_' + (q + 1), name: 'PI ' + (q + 1) + ' ' + y, start: U.toISO(new Date(Date.UTC(y, q * 3, 1))), end: U.toISO(new Date(Date.UTC(y, q * 3 + 3, 0))) });
      }
    }
    return out;
  }

  return { build: build, quarterPIs: quarterPIs, RETIRED_REDUCTIONS: RETIRED_REDUCTIONS, RETIRED_EPICS: RETIRED_EPICS };
})();

if (typeof module !== 'undefined') module.exports = OOSSeed;
