#!/usr/bin/env bash

ansible-playbook -i hosts -vvvv playbooks/happn-cluster.yml
