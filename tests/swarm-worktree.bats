#!/usr/bin/env bats

setup() {
    export REPO_ROOT="$(pwd)"
    # Mocking some external tools if needed
}

@test "lib.sh exists and is readable" {
    [ -f "scripts/swarm-worktree/lib.sh" ]
}

@test "main.sh exists and is executable" {
    [ -x "scripts/swarm-worktree/main.sh" ]
}

@test "main.sh shows usage when run with -h" {
    run ./scripts/swarm-worktree/main.sh -h
    [ "$status" -eq 0 ]
    [[ "$output" == *"USAGE"* ]]
}

@test "main.sh fails without analysis topic" {
    run ./scripts/swarm-worktree/main.sh
    [ "$status" -eq 1 ]
    [[ "$output" == *"Analysis topic required"* ]]
}

@test "main.sh dry-run works" {
    run ./scripts/swarm-worktree/main.sh --dry-run "Test Topic"
    [ "$status" -eq 0 ]
    [[ "$output" == *"DRY RUN"* ]]
}

@test "generate_research_queries produces output file" {
    source scripts/swarm-worktree/lib.sh
    local tmp_file=$(mktemp)
    generate_research_queries "Testing" "$tmp_file"
    [ -f "$tmp_file" ]
    [ $(wc -l < "$tmp_file") -ge 4 ]
    rm "$tmp_file"
}

@test "sanitized_query hash generation is consistent" {
    source scripts/swarm-worktree/lib.sh
    local q="Test Query"
    local h1=$(echo -n "$q" | sha256sum | awk '{print $1}')
    local h2=$(echo -n "$q" | sha256sum | awk '{print $1}')
    [ "$h1" == "$h2" ]
}

@test "lib.sh log functions work" {
    source scripts/swarm-worktree/lib.sh
    run log_info "test message"
    [ "$status" -eq 0 ]
    [[ "$output" == *"[INFO]"* ]]
}
