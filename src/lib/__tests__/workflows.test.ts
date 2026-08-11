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
      expect(job.if).toContain('contains(github.event.pull_request.labels.*.name, \'automerge\')')
    })

    it('should only trigger for dependabot or jules bots', () => {
      const job = workflow.jobs['auto-merge']
      expect(job.if).toContain('github.actor == \'dependabot[bot]\'')
      expect(job.if).toContain('github.actor == \'google-labs-jules[bot]\'')
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
})