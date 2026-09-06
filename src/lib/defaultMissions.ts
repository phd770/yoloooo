import { CustomButton } from './types';

export const DEFAULT_MISSIONS: (Omit<CustomButton, 'id'> & { id: string, type: 'office' | 'evening' | 'both' })[] = [
  // Tier 1 - ⭐ קלה ומתוקה (תמיד זמינה)
  {
    id: 'def-hug-long',
    label: 'חיבוק ארוך',
    actionText: 'תן/י לי חיבוק חם וארוך של 20-30 שניות.',
    fullText: 'תן/י לי חיבוק חם וארוך של 20-30 שניות.',
    pointsValue: 8,
    tier: 1,
    type: 'both'
  },
  {
    id: 'def-kiss-soft',
    label: 'נשיקה רכה',
    actionText: 'נשיקה עדינה על השפתיים, הצוואר או המצח.',
    fullText: 'נשיקה עדינה על השפתיים, הצוואר או המצח.',
    pointsValue: 10,
    tier: 1,
    type: 'both'
  },
  {
    id: 'def-touch-gentle',
    label: 'נגיעה עדינה',
    actionText: 'לטף/י לי את היד, הגב, הלחי או השיער 15 שניות.',
    fullText: 'לטף/י לי את היד, הגב, הלחי או השיער 15 שניות.',
    pointsValue: 12,
    tier: 1,
    type: 'both'
  },
  {
    id: 'def-compliment-sweet',
    label: 'מחמאה מתוקה',
    actionText: 'תכתוב/י לי 3 מחמאות אישיות ומתוקות.',
    fullText: 'תכתוב/י לי 3 מחמאות אישיות ומתוקות.',
    pointsValue: 10,
    tier: 1,
    type: 'both'
  },
  {
    id: 'def-msg-warm',
    label: 'הודעה חמה',
    actionText: 'שלח/י לי הודעה: ‘אני חושב/ת עלייך עכשיו ומחייך/ת’.',
    fullText: 'שלח/י לי הודעה: ‘אני חושב/ת עלייך עכשיו ומחייך/ת’.',
    pointsValue: 15,
    tier: 1,
    type: 'both'
  },
  {
    id: 'def-hug-back',
    label: 'חיבוק מאחור',
    actionText: 'תחבק/י אותי מאחור ותלחש/י משהו נחמד באוזן.',
    fullText: 'תחבק/י אותי מאחור ותלחש/י משהו נחמד באוזן.',
    pointsValue: 12,
    tier: 1,
    type: 'both'
  },
  {
    id: 'def-kiss-eyes',
    label: 'נשיקה על העיניים',
    actionText: 'תן/י לי נשיקות עדינות על העפעפיים או המצח.',
    fullText: 'תן/י לי נשיקות עדינות על העפעפיים או המצח.',
    pointsValue: 8,
    tier: 1,
    type: 'both'
  },
  {
    id: 'def-massage-shoulders',
    label: 'מסאז\' כתפיים קצר',
    actionText: 'מסאז\' רך של 2-3 דקות על הכתפיים או הצוואר.',
    fullText: 'מסאז\' רך של 2-3 דקות על הכתפיים או הצוואר.',
    pointsValue: 15,
    tier: 1,
    type: 'both'
  },

  // Tier 2 - ⭐⭐ שובבה (נפתחת ב-65 נקודות)
  {
    id: 'def-no-underwear',
    label: 'בלי תחתונים',
    actionText: 'תוריד/י את התחתונים עכשיו ותשאיר/י אותם בתיק.',
    fullText: 'תוריד/י את התחתונים עכשיו ותשאיר/י אותם בתיק.',
    pointsValue: 25,
    tier: 2,
    type: 'both'
  },
  {
    id: 'def-kiss-deep',
    label: 'נשיקה עמוקה',
    actionText: 'תן/י לי נשיקה עמוקה וממושכת.',
    fullText: 'תן/י לי נשיקה עמוקה וממושכת.',
    pointsValue: 20,
    tier: 2,
    type: 'both'
  },
  {
    id: 'def-photo-naughty',
    label: 'תמונה שובבה',
    actionText: 'צלם/י תמונה שובבה של חלק בגוף נסתר (לא חשוף לגמרי).',
    fullText: 'צלם/י תמונה שובבה של חלק בגוף נסתר (לא חשוף לגמרי).',
    pointsValue: 30,
    tier: 2,
    type: 'both'
  },
  {
    id: 'def-massage-naughty',
    label: 'מסאז\' שובב',
    actionText: 'מסאז\' של 5-10 דקות – כתפיים + קצת יותר נמוך.',
    fullText: 'מסאז\' של 5-10 דקות – כתפיים + קצת יותר נמוך.',
    pointsValue: 25,
    tier: 2,
    type: 'both'
  },
  {
    id: 'def-teaser-evening',
    label: 'טיזר לערב',
    actionText: 'משימה נעולה עד 20:00 – תחשוב/י עליי בצורה שובבה.',
    fullText: 'משימה נעולה עד 20:00 – תחשוב/י עליי בצורה שובבה.',
    pointsValue: 20,
    tier: 2,
    type: 'evening'
  },
  {
    id: 'def-control-light',
    label: 'שליטה קלה',
    actionText: '3 פקודות קטנות עד הערב (כולן עדינות).',
    fullText: '3 פקודות קטנות עד הערב (כולן עדינות).',
    pointsValue: 35,
    tier: 2,
    type: 'both'
  },
  {
    id: 'def-fantasy-short',
    label: 'פנטזיה קצרה',
    actionText: 'תכתוב/י לי פנטזיה קצרה ומתוקה.',
    fullText: 'תכתוב/י לי פנטזיה קצרה ומתוקה.',
    pointsValue: 28,
    tier: 2,
    type: 'both'
  },
  {
    id: 'def-dance-sexy',
    label: 'ריקוד סקסי קל',
    actionText: 'ריקוד של 60 שניות – תנועות עדינות ומפתות.',
    fullText: 'ריקוד של 60 שניות – תנועות עדינות ומפתות.',
    pointsValue: 30,
    tier: 2,
    type: 'both'
  },

  // Tier 3 - ⭐⭐⭐ חמה (נפתחת ב-130 נקודות)
  {
    id: 'def-toy-office',
    label: 'צעצוע קטן במשרד',
    actionText: 'תשים/י צעצוע קטן (ויברטור/פלאג) ותשאיר/י אותו עד הערב.',
    fullText: 'תשים/י צעצוע קטן (ויברטור/פלאג) ותשאיר/י אותו עד הערב.',
    pointsValue: 65,
    tier: 3,
    type: 'office'
  },
  {
    id: 'def-control-30min',
    label: 'שליטה 30 דקות',
    actionText: 'מהרגע הזה אני שולט/ת בך 30 דקות – כל פקודה חובה.',
    fullText: 'מהרגע הזה אני שולט/ת בך 30 דקות – כל פקודה חובה.',
    pointsValue: 70,
    tier: 3,
    type: 'both'
  },
  {
    id: 'def-hand-under-table',
    label: 'עבודה עם יד אחת',
    actionText: '10 דקות עבודה עם יד אחת מתחת לשולחן – תנועות אמיתיות.',
    fullText: '10 דקות עבודה עם יד אחת מתחת לשולחן – תנועות אמיתיות.',
    pointsValue: 60,
    tier: 3,
    type: 'office'
  },
  {
    id: 'def-fantasy-detailed',
    label: 'פנטזיה מפורטת',
    actionText: 'תכתוב/י לי פנטזיה ארוכה ומפורטת (מינימום 6 משפטים).',
    fullText: 'תכתוב/י לי פנטזיה ארוכה ומפורטת (מינימום 6 משפטים).',
    pointsValue: 55,
    tier: 3,
    type: 'both'
  },
  {
    id: 'def-no-underwear-move',
    label: 'בלי תחתונים + תנועות',
    actionText: 'בלי תחתונים + 3 פעמים תעשה/י תנועות קטנות בישבן.',
    fullText: 'בלי תחתונים + 3 פעמים תעשה/י תנועות קטנות בישבן.',
    pointsValue: 50,
    tier: 3,
    type: 'office'
  },
  {
    id: 'def-kiss-touch-office',
    label: 'נשיקה + נגיעה',
    actionText: 'תן/י לי נשיקה + תיגע/י בי במקום סודי במשרד.',
    fullText: 'תן/י לי נשיקה + תיגע/י בי במקום סודי במשרד.',
    pointsValue: 58,
    tier: 3,
    type: 'office'
  },
  {
    id: 'def-teaser-mental',
    label: 'טיזר מנטלי',
    actionText: 'עד 20:00 אל תיגע/י בעצמך – רק תחשוב/י עליי.',
    fullText: 'עד 20:00 אל תיגע/י בעצמך – רק תחשוב/י עליי.',
    pointsValue: 45,
    tier: 3,
    type: 'evening'
  },
  {
    id: 'def-voice-dirty',
    label: 'הודעה קולית מלוכלכת',
    actionText: 'שלח/י לי הודעה קולית של 15 שניות עם פנטזיה.',
    fullText: 'שלח/י לי הודעה קולית של 15 שניות עם פנטזיה.',
    pointsValue: 62,
    tier: 3,
    type: 'both'
  },
  {
    id: 'def-photo-view-once',
    label: '📸 תמונה חד-פעמית לוהטת',
    actionText: 'צלם/י תמונה חד-פעמית לוהטת (עירום חלקי, פוזה מגרה).',
    fullText: 'צלם/י תמונה חד-פעמית לוהטת (עירום חלקי, פוזה מגרה).',
    pointsValue: 65,
    tier: 3,
    type: 'both',
    isViewOnce: true
  },

  // Tier 4 - ⭐⭐⭐⭐ חריגה (נפתחת ב-250 נקודות)
  {
    id: 'def-2-toys-office',
    label: '2 צעצועים',
    actionText: 'תכניס/י 2 צעצועים (ויברטור + פלאג) ותשאיר/י אותם עד הערב. תשלח/י תמונה כל שעה.',
    fullText: 'תכניס/י 2 צעצועים (ויברטור + פלאג) ותשאיר/י אותם עד הערב. תשלח/י תמונה כל שעה.',
    pointsValue: 85,
    tier: 4,
    type: 'office'
  },
  {
    id: 'def-binding-light',
    label: 'כבילה קלה + עיניים',
    actionText: 'תכין/י כבלים/צעיף + רצועת עיניים. בערב תשתמש/י בהם בזמן שאני שולט/ת.',
    fullText: 'תכין/י כבלים/צעיף + רצועת עיניים. בערב תשתמש/י בהם בזמן שאני שולט/ת.',
    pointsValue: 90,
    tier: 4,
    type: 'evening'
  },
  {
    id: 'def-naked-evening',
    label: 'ערב עירום מלא',
    actionText: 'מה-20:00 – את/ה עירום/ה לחלוטין כל הערב. אין בגדים בכלל.',
    fullText: 'מה-20:00 – את/ה עירום/ה לחלוטין כל הערב. אין בגדים בכלל.',
    pointsValue: 95,
    tier: 4,
    type: 'evening'
  },
  {
    id: 'def-fantasy-anal',
    label: 'פנטזיה אנאלית מלאה',
    actionText: 'תכתוב/י לי פנטזיה אנאלית מפורטת – נממש אותה הערב.',
    fullText: 'תכתוב/י לי פנטזיה אנאלית מפורטת – נממש אותה הערב.',
    pointsValue: 80,
    tier: 4,
    type: 'both'
  },
  {
    id: 'def-control-90min',
    label: 'שליטה מלאה 90 דקות',
    actionText: 'מה-20:00 אני שולט/ת בך 90 דקות רצוף – כל פקודה = חובה.',
    fullText: 'מה-20:00 אני שולט/ת בך 90 דקות רצוף – כל פקודה = חובה.',
    pointsValue: 100,
    tier: 4,
    type: 'evening'
  },
  {
    id: 'def-video-20s',
    label: 'וידאו של ביצוע',
    actionText: 'צלם/י וידאו 20 שניות שלך מבצע/ת את המשימה (עם קול).',
    fullText: 'צלם/י וידאו 20 שניות שלך מבצע/ת את המשימה (עם קול).',
    pointsValue: 75,
    tier: 4,
    type: 'both'
  },
  {
    id: 'def-slave-mode',
    label: '"את/ה העבד/ה שלי"',
    actionText: 'מהרגע הזה עד הבוקר – את/ה העבד/ה שלי. תענה/י "כן אדון/גברת".',
    fullText: 'מהרגע הזה עד הבוקר – את/ה העבד/ה שלי. תענה/י "כן אדון/גברת".',
    pointsValue: 110,
    tier: 4,
    type: 'both'
  },
  {
    id: 'def-office-objects',
    label: 'משחק חפצים מהמשרד',
    actionText: 'תיקח/י 3 חפצים מהשולחן (עט, בקבוק, מחשבון) ותשתמש/י בהם על הגוף 40 שניות.',
    fullText: 'תיקח/י 3 חפצים מהשולחן (עט, בקבוק, מחשבון) ותשתמש/י בהם על הגוף 40 שניות.',
    pointsValue: 70,
    tier: 4,
    type: 'office'
  },
  {
    id: 'def-photo-view-once-extreme',
    label: '📸 תמונה חד-פעמית חריגה',
    actionText: 'צלם/י תמונה חד-פעמית חריגה (עירום מלא, מגע עצמי).',
    fullText: 'צלם/י תמונה חד-פעמית חריגה (עירום מלא, מגע עצמי).',
    pointsValue: 80,
    tier: 4,
    type: 'both',
    isViewOnce: true
  },

  // Tier 5 - ⭐⭐⭐⭐⭐ קיצונית (ללא גבולות – נפתחת ב-400 נקודות)
  {
    id: 'def-control-overnight',
    label: 'שליטה לכל הלילה',
    actionText: 'מה-20:00 עד הבוקר אני שולט/ת בך ללא שום גבולות. כל פקודה = חובה מוחלטת.',
    fullText: 'מה-20:00 עד הבוקר אני שולט/ת בך ללא שום גבולות. כל פקודה = חובה מוחלטת.',
    pointsValue: 130,
    tier: 5,
    type: 'evening'
  },
  {
    id: 'def-3-toys-binding',
    label: '3 צעצועים + כבילה מלאה',
    actionText: 'תשתמש/י ב-3 צעצועים + כבילה מלאה + רצועת עיניים. תשלח/י וידאו חי.',
    fullText: 'תשתמש/י ב-3 צעצועים + כבילה מלאה + רצועת עיניים. תשלח/י וידאו חי.',
    pointsValue: 140,
    tier: 5,
    type: 'evening'
  },
  {
    id: 'def-fantasy-no-limits',
    label: 'פנטזיה ללא גבולות',
    actionText: 'תכתוב/י לי את הפנטזיה הכי מלוכלכת, אסורה ומביכה שלך – נממש אותה.',
    fullText: 'תכתוב/י לי את הפנטזיה הכי מלוכלכת, אסורה ומביכה שלך – נממש אותה.',
    pointsValue: 120,
    tier: 5,
    type: 'both'
  },
  {
    id: 'def-bdsm-evening',
    label: 'ערב BDSM מלא',
    actionText: 'ערב שלם: ספנקינג חזק, פקודות מילוליות, כבילה, משחק כאב/עונג.',
    fullText: 'ערב שלם: ספנקינג חזק, פקודות מילוליות, כבילה, משחק כאב/עונג.',
    pointsValue: 150,
    tier: 5,
    type: 'evening'
  },
  {
    id: 'def-property-mode',
    label: '"את/ה הרכוש שלי"',
    actionText: 'מהרגע הזה את/ה הרכוש שלי. תעשה/י כל דבר שאדרוש, כולל דברים שאסור.',
    fullText: 'מהרגע הזה את/ה הרכוש שלי. תעשה/י כל דבר שאדרוש, כולל דברים שאסור.',
    pointsValue: 160,
    tier: 5,
    type: 'both'
  },
  {
    id: 'def-video-60s',
    label: 'וידאו 60 שניות',
    actionText: 'צלם/י וידאו 60 שניות שלך מבצע/ת את המשימה עם קול ותנועות מלאות.',
    fullText: 'צלם/י וידאו 60 שניות שלך מבצע/ת את המשימה עם קול ותנועות מלאות.',
    pointsValue: 110,
    tier: 5,
    type: 'both'
  },
  {
    id: 'def-roleplay-master-slave',
    label: 'רול-פליי אדון/שפחה מלא',
    actionText: 'ערב שלם של רול-פליי אדון/שפחה – תקרא/י לי בשם + תבצע/י כל פקודה.',
    fullText: 'ערב שלם של רול-פליי אדון/שפחה – תקרא/י לי בשם + תבצע/י כל פקודה.',
    pointsValue: 145,
    tier: 5,
    type: 'evening'
  },
  {
    id: 'def-fantasy-forbidden',
    label: 'פנטזיה אסורה',
    actionText: 'תכתוב/י לי פנטזיה אסורה (בגידה, כאב, השפלה, הכל) – נראה מה נעשה.',
    fullText: 'תכתוב/י לי פנטזיה אסורה (בגידה, כאב, השפלה, הכל) – נראה מה נעשה.',
    pointsValue: 155,
    tier: 5,
    type: 'both'
  },
  {
    id: 'def-photo-view-once-extreme-5',
    label: '📸 תמונה חד-פעמית קיצונית',
    actionText: 'צלם/י תמונה חד-פעמית קיצונית (עירום מלא, וידאו קצר, או משהו אסור).',
    fullText: 'צלם/י תמונה חד-פעמית קיצונית (עירום מלא, וידאו קצר, או משהו אסור).',
    pointsValue: 110,
    tier: 5,
    type: 'both',
    isViewOnce: true
  }
];
