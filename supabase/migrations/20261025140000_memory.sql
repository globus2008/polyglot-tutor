-- Phase 3: lesson memory – topic catalogue, mistake patterns, lesson analysis.

-- ---------------------------------------------------------------------------
-- More languages: German, Italian, French, Russian
-- ---------------------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array['learner_profiles', 'topics', 'lessons', 'mistakes', 'vocab_items'] loop
    execute format('alter table public.%I drop constraint %I', t, t || '_language_check');
    execute format(
      'alter table public.%I add constraint %I check (language in (''es'', ''en'', ''de'', ''it'', ''fr'', ''ru''))',
      t, t || '_language_check');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Lessons: analysis results
-- ---------------------------------------------------------------------------

alter table public.lessons drop constraint lessons_status_check;
alter table public.lessons add constraint lessons_status_check
  check (status in ('active', 'finished', 'analyzing', 'analyzed', 'failed'));
-- full structured result of the post-lesson analysis (summary_cs, vocabulary, recommendation, …)
alter table public.lessons add column analysis jsonb;

-- ---------------------------------------------------------------------------
-- Mistakes: one row per recurring pattern
-- ---------------------------------------------------------------------------

-- short stable identifier of the mistake pattern, e.g. "ser_vs_estar" or "past_simple:go"
alter table public.mistakes add column pattern_key text;
-- consecutive lessons where the pattern was practised without repeating the mistake
alter table public.mistakes add column clean_lessons integer not null default 0;
create unique index mistakes_pattern on public.mistakes (user_id, language, pattern_key);

-- ---------------------------------------------------------------------------
-- Topic catalogue – every scenario exists for every language.
-- Tags use the interest labels from the learner profile so the planner can match them.
-- ---------------------------------------------------------------------------

insert into public.topics (id, language, cefr_level, title, title_cs, scenario, tags)
select l.language || '-' || t.slug, l.language, t.cefr_level, t.title, t.title_cs, t.scenario, t.tags
from (values ('es'), ('en'), ('de'), ('it'), ('fr'), ('ru')) as l (language)
cross join (values
  -- A1
  ('a1-introductions', 'A1', 'Meeting someone new', 'Seznámení', 'Learner meets the tutor at a language café: names, where they are from, where they live, job or school.', array['rodina a vztahy']),
  ('a1-family', 'A1', 'My family', 'Moje rodina', 'Talk about family members: names, ages, what they do, who lives where.', array['rodina a vztahy']),
  ('a1-cafe-order', 'A1', 'Ordering at a café', 'Objednávka v kavárně', 'Role-play: tutor is a waiter, learner orders drinks and a snack, asks the price and pays.', array['jídlo a vaření', 'cestování']),
  ('a1-daily-routine', 'A1', 'My day', 'Můj den', 'Describe a normal day: getting up, meals, work or school, evening, with times.', array['běžný život']),
  ('a1-numbers-shopping', 'A1', 'At the market', 'Na trhu', 'Role-play: buying fruit and vegetables, quantities, prices, numbers.', array['jídlo a vaření']),
  ('a1-home', 'A1', 'Where I live', 'Kde bydlím', 'Describe your home and rooms, what is in them, and your neighbourhood.', array['běžný život']),
  ('a1-weather', 'A1', 'Weather and seasons', 'Počasí a roční období', 'Talk about today''s weather, favourite season and what you do in each season.', array['příroda']),
  ('a1-hobbies', 'A1', 'What I like', 'Co mám rád', 'Likes and dislikes: hobbies, food, music, sports – simple reasons why.', array['hudba', 'sport', 'filmy a seriály']),
  ('a1-directions', 'A1', 'Asking the way', 'Ptáme se na cestu', 'Role-play: tourist asks a local how to get to the station, a museum and a pharmacy.', array['cestování']),
  ('a1-clothes', 'A1', 'Buying clothes', 'Nákup oblečení', 'Role-play in a clothes shop: colours, sizes, trying on, price.', array['běžný život']),
  ('a1-animals', 'A1', 'Pets and animals', 'Domácí mazlíčci a zvířata', 'Talk about pets you have or would like, favourite animals and what they are like.', array['příroda']),
  ('a1-food-likes', 'A1', 'Breakfast, lunch and dinner', 'Snídaně, oběd a večeře', 'What you usually eat and drink at each meal, favourite dishes from home.', array['jídlo a vaření']),
  -- A2
  ('a2-weekend', 'A2', 'Last weekend', 'Minulý víkend', 'Tell what you did last weekend; tutor asks follow-up questions about where, with whom, how it was.', array['běžný život']),
  ('a2-hotel', 'A2', 'Checking into a hotel', 'Ubytování v hotelu', 'Role-play at a hotel reception: reservation, room problems, breakfast time, local tips.', array['cestování']),
  ('a2-restaurant', 'A2', 'Dinner at a restaurant', 'Večeře v restauraci', 'Role-play: booking a table, ordering a full meal, asking about ingredients, a small complaint, the bill.', array['jídlo a vaření', 'cestování']),
  ('a2-doctor', 'A2', 'At the doctor''s', 'U lékaře', 'Role-play: describing symptoms, how long, understanding simple advice and medicine instructions.', array['zdraví']),
  ('a2-train-tickets', 'A2', 'Buying train tickets', 'Jízdenky na vlak', 'Role-play at a station: destinations, times, return ticket, platform, delays.', array['cestování']),
  ('a2-childhood', 'A2', 'When I was a child', 'Když jsem byl malý', 'Memories of childhood: where you lived, games, school, friends, holidays.', array['rodina a vztahy']),
  ('a2-recipe', 'A2', 'My favourite recipe', 'Můj oblíbený recept', 'Explain step by step how to cook a dish you like; ingredients and quantities.', array['jídlo a vaření']),
  ('a2-sport', 'A2', 'Sport and staying active', 'Sport a pohyb', 'Sports you do or watch, how often, a memorable match or race.', array['sport', 'zdraví']),
  ('a2-plans', 'A2', 'Plans for the holidays', 'Plány na dovolenou', 'Where you are going, how, with whom, what you want to do there.', array['cestování']),
  ('a2-phone-call', 'A2', 'Making an appointment by phone', 'Domluva schůzky po telefonu', 'Role-play: calling a hairdresser or mechanic to arrange, move and confirm an appointment.', array['běžný život']),
  ('a2-flat-search', 'A2', 'Looking for a flat', 'Hledání bytu', 'Role-play with a landlord: rooms, rent, furniture, neighbourhood, when you can move in.', array['běžný život']),
  ('a2-films', 'A2', 'A film I saw', 'Film, který jsem viděl', 'Describe a recent film or series: story, characters, whether you recommend it.', array['filmy a seriály']),
  ('a2-music', 'A2', 'Music in my life', 'Hudba v mém životě', 'Favourite bands and songs, concerts you attended, music you listened to when younger.', array['hudba']),
  ('a2-lost-luggage', 'A2', 'Lost luggage', 'Ztracené zavazadlo', 'Role-play at the airport desk: describing your suitcase, contents, flight, contact details.', array['cestování']),
  ('a2-gifts', 'A2', 'Choosing a present', 'Výběr dárku', 'Role-play in a shop: choosing a gift for a family member, comparing options and prices.', array['rodina a vztahy']),
  -- B1
  ('b1-job-interview', 'B1', 'Job interview', 'Pracovní pohovor', 'Role-play: tutor interviews the learner for a job they would like; experience, strengths, motivation.', array['práce a kariéra']),
  ('b1-travel-story', 'B1', 'A trip to remember', 'Cesta, na kterou nezapomenu', 'Tell the story of a memorable trip, including something that went wrong and how it was solved.', array['cestování']),
  ('b1-complaint', 'B1', 'Making a complaint', 'Reklamace', 'Role-play: returning a faulty product, explaining the problem, negotiating a refund or exchange.', array['běžný život']),
  ('b1-healthy-life', 'B1', 'Healthy habits', 'Zdravý životní styl', 'Diet, sleep, exercise and stress: what you do, what you would like to change and how.', array['zdraví', 'sport']),
  ('b1-technology-daily', 'B1', 'Technology in everyday life', 'Technologie v každodenním životě', 'Phones, apps and the internet: how they help or harm, screen time, favourite apps.', array['technologie']),
  ('b1-book', 'B1', 'A book that stayed with me', 'Kniha, která mi utkvěla', 'Talk about a book: plot without spoilers, why it was memorable, who should read it.', array['knihy']),
  ('b1-festivals', 'B1', 'Festivals and traditions', 'Svátky a tradice', 'Compare holidays and traditions from your country with those of the target-language countries.', array['historie a kultura']),
  ('b1-car-rental', 'B1', 'Renting a car', 'Půjčení auta', 'Role-play: renting a car abroad, insurance, fuel policy, a scratch on return.', array['cestování']),
  ('b1-neighbours', 'B1', 'Problems with neighbours', 'Problémy se sousedy', 'Role-play: politely asking a noisy neighbour to change something and finding a compromise.', array['běžný život', 'rodina a vztahy']),
  ('b1-hiking', 'B1', 'Outdoors and hiking', 'Výlety do přírody', 'Favourite places in nature, planning a hike, what to pack, a surprising experience outdoors.', array['příroda', 'sport']),
  ('b1-cooking-culture', 'B1', 'Food culture', 'Kultura jídla', 'Typical dishes and eating habits of the target-language countries compared to Czech ones.', array['jídlo a vaření', 'historie a kultura']),
  ('b1-games', 'B1', 'Games and play', 'Hry a hraní', 'Board games, video games or card games you enjoy; explain the rules of one game.', array['hry']),
  ('b1-learning-languages', 'B1', 'Learning languages', 'Učení jazyků', 'Your experience learning languages: what works, what is hard, tips and funny mistakes.', array['běžný život']),
  ('b1-work-routine', 'B1', 'My work or studies', 'Moje práce nebo studium', 'Describe your job or studies in detail: tasks, colleagues, what you like and dislike.', array['práce a kariéra']),
  ('b1-bank', 'B1', 'At the bank', 'V bance', 'Role-play: opening an account, a lost card, transferring money abroad.', array['byznys a finance']),
  ('b1-volunteering', 'B1', 'Helping others', 'Pomoc druhým', 'Volunteering, charity and helping neighbours: experiences and opinions.', array['politika a společnost']),
  -- B2
  ('b2-remote-work', 'B2', 'Remote work: pros and cons', 'Práce na dálku: pro a proti', 'Discussion: productivity, loneliness, cities vs villages, what the future of offices looks like.', array['práce a kariéra', 'technologie']),
  ('b2-tourism-impact', 'B2', 'Mass tourism', 'Masová turistika', 'Debate the effects of tourism on popular cities (e.g. Prague and famous cities where the language is spoken); possible solutions.', array['cestování', 'politika a společnost']),
  ('b2-ai', 'B2', 'Artificial intelligence', 'Umělá inteligence', 'How AI changes work, education and creativity; hopes and worries; personal experience.', array['technologie', 'věda']),
  ('b2-negotiation', 'B2', 'Negotiating a deal', 'Vyjednávání', 'Role-play: negotiating price and conditions with a supplier or a salary with an employer.', array['byznys a finance', 'práce a kariéra']),
  ('b2-environment', 'B2', 'Climate and everyday choices', 'Klima a každodenní volby', 'What individuals, companies and governments should do; your own habits and dilemmas.', array['příroda', 'politika a společnost']),
  ('b2-history-event', 'B2', 'A historical turning point', 'Historický zlom', 'Explain an important event in Czech or target-language history and its consequences today.', array['historie a kultura']),
  ('b2-series-analysis', 'B2', 'Why we binge-watch', 'Proč koukáme na seriály', 'Analyse a series you like: characters, storytelling tricks, cultural impact.', array['filmy a seriály']),
  ('b2-education', 'B2', 'Schools and education', 'Školství a vzdělávání', 'Compare school systems, what schools should teach, homework, exams and motivation.', array['politika a společnost', 'rodina a vztahy']),
  ('b2-personal-finance', 'B2', 'Money and saving', 'Peníze a spoření', 'Budgeting, saving, investing, attitudes to debt; advice for young people.', array['byznys a finance']),
  ('b2-sport-business', 'B2', 'Sport as business', 'Sport jako byznys', 'Huge salaries, sponsorship, fans and clubs; is professional sport still fair?', array['sport', 'byznys a finance']),
  ('b2-music-industry', 'B2', 'Music in the streaming era', 'Hudba v době streamování', 'How streaming changed listening habits and artists'' income; discovering new music.', array['hudba', 'technologie']),
  ('b2-health-system', 'B2', 'Healthcare systems', 'Zdravotnictví', 'Public vs private healthcare, waiting times, prevention; experiences abroad.', array['zdraví', 'politika a společnost']),
  ('b2-city-village', 'B2', 'City or countryside?', 'Město, nebo venkov?', 'Debate where it is better to live and raise children; housing prices, transport, community.', array['rodina a vztahy', 'běžný život']),
  ('b2-science-discovery', 'B2', 'A fascinating discovery', 'Fascinující objev', 'Explain a scientific discovery or invention you find fascinating and why it matters.', array['věda']),
  -- C1
  ('c1-ethics-tech', 'C1', 'Technology and ethics', 'Technologie a etika', 'Discuss privacy, surveillance and data ownership; argue both sides and reach a nuanced view.', array['technologie', 'politika a společnost']),
  ('c1-leadership', 'C1', 'What makes a good leader', 'Co dělá dobrého lídra', 'Leadership styles at work and in politics, with examples; handling conflict in a team.', array['práce a kariéra', 'politika a společnost']),
  ('c1-literature', 'C1', 'Literature in translation', 'Literatura v překladu', 'What gets lost in translation; authors from the target-language world; reading in the original.', array['knihy', 'historie a kultura']),
  ('c1-economy', 'C1', 'Inflation and the economy', 'Inflace a ekonomika', 'Explain causes and effects of inflation and how it affects households; policy options.', array['byznys a finance', 'politika a společnost']),
  ('c1-identity', 'C1', 'Language and identity', 'Jazyk a identita', 'How language shapes identity; regional dialects, bilingual families, minority languages.', array['historie a kultura', 'rodina a vztahy']),
  ('c1-media', 'C1', 'News and misinformation', 'Média a dezinformace', 'How to recognise misinformation, the role of social media, trust in journalism.', array['politika a společnost', 'technologie']),
  ('c1-pitch', 'C1', 'Pitching an idea', 'Prezentace nápadu', 'Role-play: pitch a product or project to investors who ask tough questions.', array['byznys a finance', 'práce a kariéra']),
  ('c1-food-future', 'C1', 'The future of food', 'Budoucnost jídla', 'Lab-grown meat, local vs global food, food waste; persuasive arguments and counterarguments.', array['jídlo a vaření', 'věda', 'příroda']),
  ('c1-art', 'C1', 'Art that moves us', 'Umění, které nás zasáhne', 'Describe and interpret a painting, building or film in depth; why art matters.', array['historie a kultura', 'filmy a seriály']),
  ('c1-wellbeing', 'C1', 'Burnout and wellbeing', 'Vyhoření a duševní pohoda', 'Causes of burnout, work-life balance, how societies and employers should respond.', array['zdraví', 'práce a kariéra']),
  -- C2
  ('c2-humour', 'C2', 'Humour and irony', 'Humor a ironie', 'Explain jokes, puns and irony in the target language; cultural differences in humour.', array['historie a kultura']),
  ('c2-debate', 'C2', 'Formal debate', 'Formální debata', 'A structured debate on a controversial motion chosen together; rebuttals and concessions.', array['politika a společnost']),
  ('c2-idioms', 'C2', 'Idioms and register', 'Idiomy a styl', 'Retell a story switching between formal, neutral and colloquial registers; idiomatic phrasing.', array['knihy']),
  ('c2-philosophy', 'C2', 'Big questions', 'Velké otázky', 'Free will, happiness, the meaning of work – a philosophical conversation with precise argument.', array['věda', 'knihy'])
) as t (slug, cefr_level, title, title_cs, scenario, tags);
