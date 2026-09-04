import { describe, it, expect } from 'vitest';
import { groupAffiliations } from '../stream-helpers';

type Person = { id: string; display_name: string | null; attributes: Record<string, unknown> | null };

const people = (...ps: [string, string][]): Map<string, Person> =>
  new Map(ps.map(([id, name]) => [id, { id, display_name: name, attributes: null }]));

const edge = (person: string, company: string, jobTitle?: string) => ({
  source_entity_id: person,
  target_entity_id: company,
  context_data: jobTitle ? { job_title: jobTitle } : null,
});

const companies = new Map([
  ['co1', 'Pure Lavish Events'],
  ['co2', 'Brandi Jane Events'],
]);

describe('groupAffiliations', () => {
  it('lists a person once per company even when they hold several edges to it', () => {
    // The real shape: everyone currently carries MEMBER *and* ROSTER_MEMBER to
    // the same company, which listed them twice on the card.
    const { affiliatesByCompany } = groupAffiliations(
      [edge('p1', 'co1'), edge('p1', 'co1')],
      people(['p1', 'Alexa Infranca']),
      companies,
    );
    expect([...affiliatesByCompany.get('co1')!.values()]).toEqual([
      { entityId: 'p1', name: 'Alexa Infranca', jobTitle: null },
    ]);
  });

  it('fills in a job title from a later edge when the first had none', () => {
    const { affiliatesByCompany } = groupAffiliations(
      [edge('p1', 'co1'), edge('p1', 'co1', 'Lead Planner')],
      people(['p1', 'Alexa Infranca']),
      companies,
    );
    expect(affiliatesByCompany.get('co1')!.get('p1')!.jobTitle).toBe('Lead Planner');
  });

  it('does not let a later edge overwrite a job title already known', () => {
    const { affiliatesByCompany } = groupAffiliations(
      [edge('p1', 'co1', 'Lead Planner'), edge('p1', 'co1', 'Member')],
      people(['p1', 'Alexa Infranca']),
      companies,
    );
    expect(affiliatesByCompany.get('co1')!.get('p1')!.jobTitle).toBe('Lead Planner');
  });

  it('groups several people under one company', () => {
    const { affiliatesByCompany } = groupAffiliations(
      [edge('p1', 'co1'), edge('p2', 'co1')],
      people(['p1', 'Alexa Infranca'], ['p2', 'Gia Mendez']),
      companies,
    );
    expect(affiliatesByCompany.get('co1')!.size).toBe(2);
  });

  it('resolves one employer per person, first edge winning', () => {
    const { employerByPerson } = groupAffiliations(
      [edge('p1', 'co2'), edge('p1', 'co1')],
      people(['p1', 'Brandi Jane']),
      companies,
    );
    expect(employerByPerson.get('p1')).toEqual({ entityId: 'co2', name: 'Brandi Jane Events' });
  });

  it('skips edges whose person could not be loaded rather than inventing a row', () => {
    const { affiliatesByCompany, employerByPerson } = groupAffiliations(
      [edge('ghost', 'co1')],
      people(),
      companies,
    );
    expect(affiliatesByCompany.size).toBe(0);
    expect(employerByPerson.size).toBe(0);
  });

  it('omits the employer when the company is not among the visible nodes', () => {
    // A company the workspace has no edge to has no name to show, so the
    // person's card should say nothing rather than render a blank line.
    const { employerByPerson } = groupAffiliations(
      [edge('p1', 'unknown-co')],
      people(['p1', 'Alexa Infranca']),
      companies,
    );
    expect(employerByPerson.size).toBe(0);
  });
});
