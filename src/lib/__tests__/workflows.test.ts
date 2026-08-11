import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { parse } from 'yaml'

describe('GitHub Actions Workflows', () => {
  describe('Dependabot Auto-Merge Workflow', () => {
    const workflowPath = join(process.cwd(), '.github/workflows/dependabot-auto-merge.yml')
    let workflow: ReturnType<typeof parse>

    beforeAll(() => {
      const workflowContent = readFileSync(workflowPath, 'utf-8')
      workflow = parse(workflowContent)
    })

    it('should be valid YAML', () => {
      expect(workflow).toBeDefined()
      expect(workflow.name).toBe('Dependabot Auto-Merge')
    })

    it('should trigger on pull_request events', () => {
      expect(workflow.on).toBe('pull_request')
    })

    it('should have proper permissions', () => {
      expect(workflow.permissions).toEqual({ contents: 'read' })
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
    const workflowPath = join(process.cwd(), '.github/workflows/ci-and-labels.yml')
    let workflow: ReturnType<typeof parse>

    beforeAll(() => {
      const workflowContent = readFileSync(workflowPath, 'utf-8')
      workflow = parse(workflowContent)
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
      expect(workflow.permissions).toEqual({ contents: 'read' })
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
    const workflowPath = join(process.cwd(), '.github/workflows/security-scan.yml')
    let workflow: ReturnType<typeof parse>

    beforeAll(() => {
      const workflowContent = readFileSync(workflowPath, 'utf-8')
      workflow = parse(workflowContent)
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
      expect(workflow.permissions).toEqual({
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
})