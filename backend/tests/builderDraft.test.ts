import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';
import { prisma } from '../src/db/prisma';
import { createMember, loginAgent, cleanupDatabase } from './helpers';

const app = createApp();

// The API returns null for unset title/body/name (Prisma String?), but the
// draft schema's fields are optional-not-nullable (matches what the real
// frontend sends via blockToDraft's `?? undefined`) — convert before sending.
function n(v: string | null | undefined): string | undefined {
  return v ?? undefined;
}

interface RawBlock {
  id: string;
  blockType: string;
  name?: string | null;
  title?: string | null;
  body?: string | null;
  questions: { id: string; questionType: string; prompt: string; maxChoices: number }[];
}

describe('Survey draft save (PUT /api/surveys/:id/draft)', () => {
  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('adds, edits, deletes, reorders, and moves blocks/questions in one call', async () => {
    const creator = await createMember('CREATOR', 'Creator');
    const agent = await loginAgent(app, creator.email, creator.password);

    const createRes = await agent.post('/api/surveys').send({ title: 'Draft test survey', isAnonymous: true });
    expect(createRes.status).toBe(201);
    const surveyId = createRes.body.survey.id;

    const initial = await agent.get(`/api/surveys/${surveyId}`);
    const blocks: RawBlock[] = initial.body.survey.blocks;
    const welcome = blocks.find((b) => b.blockType === 'WELCOME')!;
    const end = blocks.find((b) => b.blockType === 'END')!;
    const block1 = blocks.find((b) => b.blockType === 'QUESTIONS')!;

    // Add a second block and two questions, one in each block.
    const saveRes = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'Draft test survey',
      isAnonymous: true,
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: block1.id,
          blockType: 'QUESTIONS',
          name: 'Block 1',
          questions: [{ questionType: 'RATING', prompt: 'How happy?', isRequired: true, ratingScaleMin: 1, ratingScaleMax: 5 }],
        },
        {
          blockType: 'QUESTIONS',
          name: 'Block 2',
          questions: [{ questionType: 'TEXT', prompt: 'Anything else?', isRequired: false }],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(saveRes.status).toBe(200);
    const savedBlocks: RawBlock[] = saveRes.body.survey.blocks;
    const questionBlocks = savedBlocks.filter((b) => b.blockType === 'QUESTIONS');
    expect(questionBlocks).toHaveLength(2);
    expect(questionBlocks[0].name).toBe('Block 1');
    expect(questionBlocks[0].questions).toHaveLength(1);
    expect(questionBlocks[1].name).toBe('Block 2');
    expect(questionBlocks[1].questions).toHaveLength(1);

    const ratingQuestion = questionBlocks[0].questions[0];
    const textQuestion = questionBlocks[1].questions[0];

    // Move the rating question into Block 2, reorder blocks, delete the text
    // question, and rename Block 1 — all in one call.
    const moveRes = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'Draft test survey',
      isAnonymous: true,
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        { id: questionBlocks[1].id, blockType: 'QUESTIONS', name: 'Block 2', questions: [{ id: ratingQuestion.id, questionType: 'RATING', prompt: 'How happy?', isRequired: true, ratingScaleMin: 1, ratingScaleMax: 5 }] },
        { id: questionBlocks[0].id, blockType: 'QUESTIONS', name: 'Block 1 renamed', questions: [] },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(moveRes.status).toBe(200);
    const movedBlocks: RawBlock[] = moveRes.body.survey.blocks;
    const movedQuestionBlocks = movedBlocks.filter((b) => b.blockType === 'QUESTIONS');
    // Order flipped: "Block 2" (now holding the moved question) is first.
    expect(movedQuestionBlocks[0].name).toBe('Block 2');
    expect(movedQuestionBlocks[0].questions.map((q) => q.id)).toEqual([ratingQuestion.id]);
    expect(movedQuestionBlocks[1].name).toBe('Block 1 renamed');
    expect(movedQuestionBlocks[1].questions).toHaveLength(0);

    // The deleted text question is gone entirely.
    const allQuestionIds = movedQuestionBlocks.flatMap((b) => b.questions.map((q) => q.id));
    expect(allQuestionIds).not.toContain(textQuestion.id);
  });

  it('rejects deleting or structurally changing a question that already has responses, leaving the survey unchanged', async () => {
    const creator = await createMember('CREATOR', 'Creator');
    const respondent = await createMember('MEMBER', 'Respondent');
    const agent = await loginAgent(app, creator.email, creator.password);

    const createRes = await agent.post('/api/surveys').send({ title: 'Conflict test', isAnonymous: false });
    const surveyId = createRes.body.survey.id;
    const detail = await agent.get(`/api/surveys/${surveyId}`);
    const blocks: RawBlock[] = detail.body.survey.blocks;
    const questionsBlock = blocks.find((b) => b.blockType === 'QUESTIONS')!;
    const welcome = blocks.find((b) => b.blockType === 'WELCOME')!;
    const end = blocks.find((b) => b.blockType === 'END')!;

    const addRes = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'Conflict test',
      isAnonymous: false,
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [
            { questionType: 'MULTI_CHOICE', prompt: 'Pick one', isRequired: true, options: ['A', 'B', 'C'], maxChoices: 1 },
            { questionType: 'TEXT', prompt: 'Freeform', isRequired: false },
          ],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(addRes.status).toBe(200);
    const savedBlock = addRes.body.survey.blocks.find((b: RawBlock) => b.blockType === 'QUESTIONS');
    const choiceQuestion = savedBlock.questions.find((q: { questionType: string }) => q.questionType === 'MULTI_CHOICE');
    const textQuestion = savedBlock.questions.find((q: { questionType: string }) => q.questionType === 'TEXT');

    await agent.put(`/api/surveys/${surveyId}/recipients`).send({ memberIds: [respondent.member.id] });
    await agent.post(`/api/surveys/${surveyId}/publish`);

    const respondentAgent = await loginAgent(app, respondent.email, respondent.password);
    const take = await respondentAgent.get(`/api/surveys/${surveyId}/take`);
    const takeChoiceQuestion = take.body.blocks
      .flatMap((b: { questions: { id: string; options: { id: string }[] }[] }) => b.questions)
      .find((q: { id: string }) => q.id === choiceQuestion.id);
    const optionId = takeChoiceQuestion.options[0].id;
    const submitRes = await respondentAgent.post(`/api/surveys/${surveyId}/responses`).send({
      answers: [
        { questionId: choiceQuestion.id, selectedOptionIds: [optionId] },
        { questionId: textQuestion.id, textValue: 'hello' },
      ],
    });
    expect(submitRes.status).toBe(201);

    await agent.post(`/api/surveys/${surveyId}/unpublish`);
    const preConflictDetail = await agent.get(`/api/surveys/${surveyId}`);

    // Attempt to change the choice question's options (structural) — rejected.
    const structuralAttempt = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'Conflict test',
      isAnonymous: false,
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [
            { id: choiceQuestion.id, questionType: 'MULTI_CHOICE', prompt: 'Pick one', isRequired: true, options: ['A', 'B'], maxChoices: 1 },
            { id: textQuestion.id, questionType: 'TEXT', prompt: 'Freeform', isRequired: false },
          ],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(structuralAttempt.status).toBe(409);
    expect(structuralAttempt.body.details).toBeDefined();

    // Attempt to delete the answered question outright — also rejected.
    const deleteAttempt = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'Conflict test',
      isAnonymous: false,
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [{ id: textQuestion.id, questionType: 'TEXT', prompt: 'Freeform', isRequired: false }],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(deleteAttempt.status).toBe(409);

    // The survey is completely untouched by either failed attempt.
    const afterFailedSaves = await agent.get(`/api/surveys/${surveyId}`);
    expect(afterFailedSaves.body.survey.blocks).toEqual(preConflictDetail.body.survey.blocks);

    // A non-structural edit (prompt only) on the answered question still succeeds.
    const nonStructural = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'Conflict test',
      isAnonymous: false,
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [
            { id: choiceQuestion.id, questionType: 'MULTI_CHOICE', prompt: 'Pick one (updated)', isRequired: true, options: ['A', 'B', 'C'], maxChoices: 1 },
            { id: textQuestion.id, questionType: 'TEXT', prompt: 'Freeform', isRequired: false },
          ],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(nonStructural.status).toBe(200);
    const updatedQuestion = nonStructural.body.survey.blocks
      .find((b: RawBlock) => b.blockType === 'QUESTIONS')
      .questions.find((q: { id: string }) => q.id === choiceQuestion.id);
    expect(updatedQuestion.prompt).toBe('Pick one (updated)');
  });

  it('enforces maxChoices on response submission and keeps the anonymity/title-uniqueness checks', async () => {
    const creator = await createMember('CREATOR', 'Creator');
    const respondent = await createMember('MEMBER', 'Respondent');
    const agent = await loginAgent(app, creator.email, creator.password);

    const createRes = await agent.post('/api/surveys').send({ title: 'MaxChoices test', isAnonymous: false });
    const surveyId = createRes.body.survey.id;
    const detail = await agent.get(`/api/surveys/${surveyId}`);
    const blocks: RawBlock[] = detail.body.survey.blocks;
    const questionsBlock = blocks.find((b) => b.blockType === 'QUESTIONS')!;
    const welcome = blocks.find((b) => b.blockType === 'WELCOME')!;
    const end = blocks.find((b) => b.blockType === 'END')!;

    const saveRes = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'MaxChoices test',
      isAnonymous: false,
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [
            { questionType: 'MULTI_CHOICE', prompt: 'Pick up to 2', isRequired: true, options: ['A', 'B', 'C'], maxChoices: 2 },
          ],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(saveRes.status).toBe(200);
    const savedQuestion = saveRes.body.survey.blocks.find((b: RawBlock) => b.blockType === 'QUESTIONS').questions[0];
    expect(savedQuestion.maxChoices).toBe(2);

    await agent.put(`/api/surveys/${surveyId}/recipients`).send({ memberIds: [respondent.member.id] });
    await agent.post(`/api/surveys/${surveyId}/publish`);

    const respondentAgent = await loginAgent(app, respondent.email, respondent.password);
    const take = await respondentAgent.get(`/api/surveys/${surveyId}/take`);
    const takeQuestion = take.body.blocks
      .flatMap((b: { questions: { id: string; maxChoices: number; options: { id: string }[] }[] }) => b.questions)
      .find((q: { id: string }) => q.id === savedQuestion.id);
    expect(takeQuestion.maxChoices).toBe(2);
    const optionIds = takeQuestion.options.map((o: { id: string }) => o.id);

    // Selecting all 3 exceeds maxChoices=2.
    const overLimit = await respondentAgent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId: savedQuestion.id, selectedOptionIds: optionIds }] });
    expect(overLimit.status).toBe(400);

    // Selecting 2 is allowed.
    const withinLimit = await respondentAgent
      .post(`/api/surveys/${surveyId}/responses`)
      .send({ answers: [{ questionId: savedQuestion.id, selectedOptionIds: optionIds.slice(0, 2) }] });
    expect(withinLimit.status).toBe(201);

    // Title uniqueness still enforced through the draft endpoint.
    await agent.post('/api/surveys').send({ title: 'Another survey', isAnonymous: false });
    await agent.post(`/api/surveys/${surveyId}/unpublish`);
    const dupTitle = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'Another survey',
      isAnonymous: false,
      blocks: saveRes.body.survey.blocks.map((b: RawBlock) => ({
        id: b.id,
        blockType: b.blockType,
        name: n(b.name),
        title: n(b.title),
        body: n(b.body),
        questions: b.questions.map((q) => ({ id: q.id, questionType: q.questionType, prompt: q.prompt, isRequired: true, options: ['A', 'B', 'C'], maxChoices: q.maxChoices })),
      })),
    });
    expect(dupTitle.status).toBe(409);
    expect(dupTitle.body.code).toBe('DUPLICATE_TITLE');

    // Anonymity lock: this survey has been published once, so isAnonymous can no longer change.
    const anonymityAttempt = await agent.put(`/api/surveys/${surveyId}/draft`).send({
      title: 'MaxChoices test',
      isAnonymous: true,
      blocks: saveRes.body.survey.blocks.map((b: RawBlock) => ({
        id: b.id,
        blockType: b.blockType,
        name: n(b.name),
        title: n(b.title),
        body: n(b.body),
        questions: b.questions.map((q) => ({ id: q.id, questionType: q.questionType, prompt: q.prompt, isRequired: true, options: ['A', 'B', 'C'], maxChoices: q.maxChoices })),
      })),
    });
    expect(anonymityAttempt.status).toBe(409);
    expect(anonymityAttempt.body.code).toBe('ANONYMITY_LOCKED');
  });
});

describe('One-on-one template draft save (PUT /api/one-on-ones/:id/draft)', () => {
  afterAll(async () => {
    await cleanupDatabase();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    await cleanupDatabase();
  });

  it('saves blocks/questions and moves a question between blocks in one call', async () => {
    const creator = await createMember('CREATOR', 'Creator');
    const agent = await loginAgent(app, creator.email, creator.password);

    const createRes = await agent.post('/api/one-on-ones').send({ title: 'Draft 1:1 template', isTemplate: true });
    expect(createRes.status).toBe(201);
    const templateId = createRes.body.template.id;

    const detail = await agent.get(`/api/one-on-ones/${templateId}`);
    const blocks: RawBlock[] = detail.body.template.blocks;
    const welcome = blocks.find((b) => b.blockType === 'WELCOME')!;
    const end = blocks.find((b) => b.blockType === 'END')!;
    const block1 = blocks.find((b) => b.blockType === 'QUESTIONS')!;

    const saveRes = await agent.put(`/api/one-on-ones/${templateId}/draft`).send({
      title: 'Draft 1:1 template',
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: block1.id,
          blockType: 'QUESTIONS',
          name: 'Growth',
          questions: [{ questionType: 'RATING', prompt: 'How is it going?', isRequired: true, ratingScaleMin: 1, ratingScaleMax: 5 }],
        },
        { blockType: 'QUESTIONS', name: 'Blockers', questions: [] },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(saveRes.status).toBe(200);
    const questionBlocks = saveRes.body.template.blocks.filter((b: RawBlock) => b.blockType === 'QUESTIONS');
    expect(questionBlocks).toHaveLength(2);
    const growthBlock = questionBlocks.find((b: RawBlock) => b.name === 'Growth');
    const blockersBlock = questionBlocks.find((b: RawBlock) => b.name === 'Blockers');
    const question = growthBlock.questions[0];

    const moveRes = await agent.put(`/api/one-on-ones/${templateId}/draft`).send({
      title: 'Draft 1:1 template',
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        { id: growthBlock.id, blockType: 'QUESTIONS', name: 'Growth', questions: [] },
        {
          id: blockersBlock.id,
          blockType: 'QUESTIONS',
          name: 'Blockers',
          questions: [{ id: question.id, questionType: 'RATING', prompt: 'How is it going?', isRequired: true, ratingScaleMin: 1, ratingScaleMax: 5 }],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(moveRes.status).toBe(200);
    const movedQuestionBlocks = moveRes.body.template.blocks.filter((b: RawBlock) => b.blockType === 'QUESTIONS');
    expect(movedQuestionBlocks.find((b: RawBlock) => b.name === 'Growth').questions).toHaveLength(0);
    expect(movedQuestionBlocks.find((b: RawBlock) => b.name === 'Blockers').questions.map((q) => q.id)).toEqual([question.id]);
  });

  it('rejects a structural change to a question that already has responses across past runs', async () => {
    const creator = await createMember('CREATOR', 'Creator');
    const recipient = await createMember('MEMBER', 'Recipient');
    const agent = await loginAgent(app, creator.email, creator.password);

    const createRes = await agent.post('/api/one-on-ones').send({ title: 'Live 1:1', isTemplate: false });
    const templateId = createRes.body.template.id;
    const detail = await agent.get(`/api/one-on-ones/${templateId}`);
    const blocks: RawBlock[] = detail.body.template.blocks;
    const questionsBlock = blocks.find((b) => b.blockType === 'QUESTIONS')!;
    const welcome = blocks.find((b) => b.blockType === 'WELCOME')!;
    const end = blocks.find((b) => b.blockType === 'END')!;

    const saveRes = await agent.put(`/api/one-on-ones/${templateId}/draft`).send({
      title: 'Live 1:1',
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [{ questionType: 'RATING', prompt: 'Mood?', isRequired: true, ratingScaleMin: 1, ratingScaleMax: 5 }],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    const question = saveRes.body.template.blocks.find((b: RawBlock) => b.blockType === 'QUESTIONS').questions[0];

    await agent.put(`/api/one-on-ones/${templateId}/recipients`).send({ memberIds: [recipient.member.id] });
    await agent.post(`/api/one-on-ones/${templateId}/publish`);
    const startRunRes = await agent.post(`/api/one-on-ones/${templateId}/runs`).send({ recipientMemberId: recipient.member.id });
    expect(startRunRes.status).toBe(201);
    const runId = startRunRes.body.run.id;

    const recipientAgent = await loginAgent(app, recipient.email, recipient.password);
    const submitRes = await recipientAgent
      .post(`/api/one-on-ones/runs/${runId}/responses`)
      .send({ answers: [{ questionId: question.id, ratingValue: 4 }] });
    expect(submitRes.status).toBe(201);

    await agent.post(`/api/one-on-ones/${templateId}/unpublish`);

    const structuralAttempt = await agent.put(`/api/one-on-ones/${templateId}/draft`).send({
      title: 'Live 1:1',
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [{ id: question.id, questionType: 'TEXT', prompt: 'Mood?', isRequired: true }],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(structuralAttempt.status).toBe(409);

    const nonStructuralAttempt = await agent.put(`/api/one-on-ones/${templateId}/draft`).send({
      title: 'Live 1:1',
      blocks: [
        { id: welcome.id, blockType: 'WELCOME', title: n(welcome.title), body: n(welcome.body), questions: [] },
        {
          id: questionsBlock.id,
          blockType: 'QUESTIONS',
          name: questionsBlock.name,
          questions: [{ id: question.id, questionType: 'RATING', prompt: 'Mood today?', isRequired: true, ratingScaleMin: 1, ratingScaleMax: 5 }],
        },
        { id: end.id, blockType: 'END', title: n(end.title), body: n(end.body), questions: [] },
      ],
    });
    expect(nonStructuralAttempt.status).toBe(200);
  });
});
