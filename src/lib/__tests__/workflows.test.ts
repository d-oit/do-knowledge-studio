import { describe, it, expect, beforeAll } from 'vitest'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

type Workflow = ReturnType<typeof parse>

/**
 * Load and parse a workflow YAML file from the .github/workflows directory.
 * Shared by all workflow test suites to avoid duplicated loading logic.
 */
const loadWorkflow = (fileName: string): Workflow => {
  const workflowPath = join(process.cwd(), '.github/workflows', fileName)
  const workflowContent = readFileSync(workflowPath, 'utf-8')
  return parse(workflowContent)
}

/**
 * Assert that a workflow declares exactly the expected top-level permissions.
 * Shared by all workflow suites to avoid duplicated permission assertions.
 */
const expectWorkflowPermissions = (workflow: Workflow, expected: object): void => {
  expect(workflow.permissions).toEqual(expected)
}

describe('GitHub Actions Workflows', () => {
  describe('Dependabot Auto-Merge Workflow', () => {
    let workflow: Workflow

    beforeAll(() => {
      workflow = loadWorkflow('dependabot-auto-merge.yml')
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('Dependabot Auto-Merge')
    })

    it('should trigger on pull_request events', () => {
      expect(workflow.on).toBe('pull_request')
    })

    it('should have proper permissions', () => {
      expectWorkflowPermissions(workflow, { contents: 'read' })
    })

    it('should have auto-merge job with label requirement', () => {
      const job = workflow.jobs['auto-merge']
      expect(job).toBeDefined()
      expect(job.if).toContain('automerge')
      expect(job.if).toContain('labels')
    })

    it('should only trigger for dependabot or jules bots', () => {
      const job = workflow.jobs['auto-merge']
      expect(job.if).toContain('dependabot[bot]')
      expect(job.if).toContain('google-labs-jules[bot]')
    })

    it('should run on ubuntu-latest with timeout', () => {
      const job = workflow.jobs['auto-merge']
      expect(job['runs-on']).toBe('ubuntu-latest')
      expect(job['timeout-minutes']).toBe(5)
    })

    it('should have proper permissions for PR operations', () => {
      const job = workflow.jobs['auto-merge']
      expect(job.permissions).toEqual({
        'pull-requests': 'write',
        contents: 'write'
      })
    })

    it('should approve and enable auto-merge', () => {
      const job = workflow.jobs['auto-merge']
      const step = job.steps[0]
      expect(step.name).toBe('Approve and enable auto-merge')
      expect(step.run).toContain('gh pr review --approve')
      expect(step.run).toContain('gh pr merge --auto --squash')
    })
  })

  describe('CI Workflow', () => {
    let workflow: Workflow

    beforeAll(() => {
      workflow = loadWorkflow('ci-and-labels.yml')
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('CI')
    })

    it('should trigger on push and pull_request events', () => {
      expect(workflow.on).toHaveProperty('push')
      expect(workflow.on).toHaveProperty('pull_request')
    })

    it('should have concurrency settings', () => {
      expect(workflow.concurrency).toBeDefined()
      expect(workflow.concurrency.group).toContain('ci-')
      expect(workflow.concurrency['cancel-in-progress']).toBe(true)
    })

    it('should have proper permissions', () => {
      expectWorkflowPermissions(workflow, { contents: 'read' })
    })

    it('should have required jobs', () => {
      expect(workflow.jobs).toHaveProperty('changes')
      expect(workflow.jobs).toHaveProperty('quality-gate')
      expect(workflow.jobs).toHaveProperty('unit-tests')
      expect(workflow.jobs).toHaveProperty('e2e-tests')
      expect(workflow.jobs).toHaveProperty('build')
      expect(workflow.jobs).toHaveProperty('coverage')
    })

    it('should have proper job dependencies', () => {
      const qualityGate = workflow.jobs['quality-gate']
      expect(qualityGate.needs).toContain('changes')

      const unitTests = workflow.jobs['unit-tests']
      expect(unitTests.needs).toContain('changes')

      const e2eTests = workflow.jobs['e2e-tests']
      expect(e2eTests.needs).toContain('changes')
      expect(e2eTests.needs).toContain('unit-tests')
    })

    it('should have proper timeouts', () => {
      const jobs = workflow.jobs
      expect(jobs['changes']['timeout-minutes']).toBe(10)
      expect(jobs['quality-gate']['timeout-minutes']).toBe(15)
      expect(jobs['unit-tests']['timeout-minutes']).toBe(15)
      expect(jobs['e2e-tests']['timeout-minutes']).toBe(20)
      expect(jobs['build']['timeout-minutes']).toBe(15)
      expect(jobs['coverage']['timeout-minutes']).toBe(20)
    })
  })

  describe('Security Scan Workflow', () => {
    let workflow: Workflow

    beforeAll(() => {
      workflow = loadWorkflow('security-scan.yml')
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('Security Scan')
    })

    it('should trigger on push, pull_request, schedule, and workflow_dispatch', () => {
      expect(workflow.on).toHaveProperty('push')
      expect(workflow.on).toHaveProperty('pull_request')
      expect(workflow.on).toHaveProperty('schedule')
      expect(workflow.on).toHaveProperty('workflow_dispatch')
    })

    it('should have proper permissions', () => {
      expectWorkflowPermissions(workflow, {
        contents: 'read',
        'security-events': 'write'
      })
    })

    it('should have security scanning jobs', () => {
      expect(workflow.jobs).toHaveProperty('shellcheck-security')
      expect(workflow.jobs).toHaveProperty('trivy-fs')
    })

    it('should have proper job names', () => {
      const shellcheck = workflow.jobs['shellcheck-security']
      expect(shellcheck.name).toBe('Shell Script Security Analysis')

      const trivy = workflow.jobs['trivy-fs']
      expect(trivy.name).toBe('Trivy Filesystem Security Scan')
    })
  })

  describe('Cleanup Workflow', () => {
    let workflow: Workflow

    beforeAll(() => {
      workflow = loadWorkflow('cleanup.yml')
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('Automated Cleanup')
    })

    it('should run on schedule and be manually dispatchable', () => {
      expect(workflow.on).toHaveProperty('schedule')
      expect(workflow.on).toHaveProperty('workflow_dispatch')
    })

    it('should have proper permissions', () => {
      expectWorkflowPermissions(workflow, {
        contents: 'read',
        'pull-requests': 'write'
      })
    })

    it('should have a detect-unused job with timeout', () => {
      const job = workflow.jobs['detect-unused']
      expect(job).toBeDefined()
      expect(job['timeout-minutes']).toBe(15)
    })

    it('should have all jobs with explicit timeouts', () => {
      const jobs = workflow.jobs
      for (const [name, job] of Object.entries(jobs)) {
        expect(job['timeout-minutes'], `job ${name}`).toBeDefined()
      }
    })
  })

  describe('Stale Issues Workflow', () => {
    let workflow: Workflow

    beforeAll(() => {
      workflow = loadWorkflow('stale.yml')
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('Stale Issues and PRs')
    })

    it('should run on a daily schedule', () => {
      expect(workflow.on).toHaveProperty('schedule')
      expect(workflow.on.schedule[0].cron).toBe('0 0 * * *')
    })

    it('should have proper permissions', () => {
      expectWorkflowPermissions(workflow, {
        contents: 'write',
        issues: 'write',
        'pull-requests': 'write'
      })
    })

    it('should use actions/stale with a timeout', () => {
      const job = workflow.jobs.stale
      expect(job).toBeDefined()
      expect(job['timeout-minutes']).toBe(15)
      const step = job.steps[0]
      expect(step.uses).toContain('actions/stale')
    })
  })

  describe('Labeler Workflow', () => {
    let workflow: Workflow

    beforeAll(() => {
      workflow = loadWorkflow('labeler.yml')
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('Pull Request Labeler')
    })

    it('should trigger on pull_request_target events', () => {
      expect(workflow.on).toHaveProperty('pull_request_target')
      const types = workflow.on.pull_request_target.types
      expect(types).toContain('opened')
      expect(types).toContain('synchronize')
    })

    it('should have proper permissions', () => {
      expectWorkflowPermissions(workflow, {
        contents: 'read',
        'pull-requests': 'write'
      })
    })

    it('should use actions/labeler', () => {
      const job = workflow.jobs.labeler
      expect(job).toBeDefined()
      const labelerStep = job.steps.find((step: { uses?: string }) =>
        step.uses?.includes('actions/labeler')
      )
      expect(labelerStep).toBeDefined()
    })
  })

  describe('PR Merge-State Diagnoser Workflow', () => {
    let workflow: Workflow

    beforeAll(() => {
      workflow = loadWorkflow('pr-merge-state-diagnoser.yml')
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('PR Merge-State Diagnoser')
    })

    it('should trigger on pull_request events with lifecycle types', () => {
      expect(workflow.on).toHaveProperty('pull_request')
      const types = workflow.on.pull_request.types
      expect(types).toContain('opened')
      expect(types).toContain('reopened')
      expect(types).toContain('synchronize')
      expect(types).toContain('ready_for_review')
    })

    it('should have proper permissions', () => {
      expectWorkflowPermissions(workflow, {
        contents: 'read',
        'pull-requests': 'write'
      })
    })

    it('should have a diagnose job with explicit timeout', () => {
      const job = workflow.jobs.diagnose
      expect(job).toBeDefined()
      expect(job['timeout-minutes']).toBe(5)
      expect(job['runs-on']).toBe('ubuntu-latest')
    })

    it('should pin the checkout action to a commit SHA', () => {
      const job = workflow.jobs.diagnose
      const checkout = job.steps[0]
      expect(checkout.uses).toMatch(/^actions\/checkout@[0-9a-f]{40}$/)
    })

    it('should invoke the shared diagnosis script with env inputs', () => {
      const job = workflow.jobs.diagnose
      const run = job.steps.find(
        (step: { name?: string }) =>
          step.name === 'Diagnose and comment'
      )
      expect(run).toBeDefined()
      expect(run.run).toBe('./scripts/diagnose-merge-state.sh')
      expect(run.env).toMatchObject({
        GH_REPO: '${{ github.repository }}',
        PR_NUMBER: '${{ github.event.pull_request.number }}',
        BASE_REF: '${{ github.event.pull_request.base.ref }}'
      })
    })

    it('should mark the diagnose step as informational (continue-on-error)', () => {
      const job = workflow.jobs.diagnose
      const run = job.steps.find(
        (step: { name?: string }) =>
          step.name === 'Diagnose and comment'
      )
      expect(run['continue-on-error']).toBe(true)
    })

    it('should ship a shellcheck-clean shared script', () => {
      const scriptPath = join(process.cwd(), 'scripts/diagnose-merge-state.sh')
      expect(existsSync(scriptPath)).toBe(true)
      const content = readFileSync(scriptPath, 'utf-8')
      expect(content).toContain('blocked-pr-diagnoser')
      expect(content).toContain('GH_REPO:?')
    })

    it('should ship a BATS regression suite for the shared script', () => {
      const batsPath = join(process.cwd(), 'tests/diagnose-merge-state.bats')
      expect(existsSync(batsPath)).toBe(true)
      const content = readFileSync(batsPath, 'utf-8')
      expect(content).toContain('diagnose-merge-state.sh')
      expect(content).toContain('load helpers/mock-gh')
      expect(content).toContain('@test')

      // The mocked-gh harness lives in the shared helper.
      const helperPath = join(process.cwd(), 'tests/helpers/mock-gh.bash')
      expect(existsSync(helperPath)).toBe(true)
      const helper = readFileSync(helperPath, 'utf-8')
      expect(helper).toContain('export -f gh')
      expect(helper).toContain('mock_gh_setup')
    })

    it('should run the BATS suite from verify.sh', () => {
      const verifyPath = join(process.cwd(), 'scripts/verify.sh')
      expect(existsSync(verifyPath)).toBe(true)
      const content = readFileSync(verifyPath, 'utf-8')
      expect(content).toContain('Shell Tests (BATS)')
      expect(content).toContain('bats tests/')
    })
  })

  describe('Workflow Template', () => {
    it('should have a valid CI template with matching properties file', () => {
      const templatePath = join(
        process.cwd(),
        '.github/workflow-templates/ci.yml'
      )
      expect(existsSync(templatePath)).toBe(true)
      const template = parse(readFileSync(templatePath, 'utf-8'))
      expect(template).toBeDefined()
      expect(template.name).toBe('CI')
      expect(template.jobs).toHaveProperty('quality-gate')
      expect(template.jobs).toHaveProperty('unit-tests')
      expect(template.jobs).toHaveProperty('build')

      const propertiesPath = join(
        process.cwd(),
        '.github/workflow-templates/ci.properties.json'
      )
      const properties = JSON.parse(
        readFileSync(propertiesPath, 'utf-8')
      ) as { name: string; description: string }
      expect(properties.name).toBe('CI Pipeline')
      expect(properties.description.length).toBeGreaterThan(0)
    })

    it('should have a valid dependabot-auto-merge template with properties file', () => {
      const templatePath = join(
        process.cwd(),
        '.github/workflow-templates/dependabot-auto-merge.yml'
      )
      expect(existsSync(templatePath)).toBe(true)
      const template = parse(readFileSync(templatePath, 'utf-8'))
      expect(template).toBeDefined()
      expect(template.name).toBe('Dependabot Auto-Merge')

      const job = template.jobs['auto-merge']
      expect(job).toBeDefined()
      expect(job.if).toContain('automerge')

      const propertiesPath = join(
        process.cwd(),
        '.github/workflow-templates/dependabot-auto-merge.properties.json'
      )
      const properties = JSON.parse(
        readFileSync(propertiesPath, 'utf-8')
      ) as { name: string; description: string }
      expect(properties.name).toBe('Dependabot Auto-Merge')
      expect(properties.description.length).toBeGreaterThan(0)
    })

    it('should have a valid security-scan template with properties file', () => {
      const templatePath = join(
        process.cwd(),
        '.github/workflow-templates/security-scan.yml'
      )
      expect(existsSync(templatePath)).toBe(true)
      const template = parse(readFileSync(templatePath, 'utf-8'))
      expect(template).toBeDefined()
      expect(template.name).toBe('Security Scan')
      expect(template.jobs).toHaveProperty('shellcheck')
      expect(template.jobs).toHaveProperty('secret-detection')
      expect(template.jobs).toHaveProperty('trivy-fs')

      const propertiesPath = join(
        process.cwd(),
        '.github/workflow-templates/security-scan.properties.json'
      )
      const properties = JSON.parse(
        readFileSync(propertiesPath, 'utf-8')
      ) as { name: string; description: string }
      expect(properties.name).toBe('Security Scan')
      expect(properties.description.length).toBeGreaterThan(0)
    })
  })
})