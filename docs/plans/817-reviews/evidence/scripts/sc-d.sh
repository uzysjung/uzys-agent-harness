bash /s/step.sh o ah-$1 install --track tooling --cli claude
bash /s/mine.sh .uzys-agent-harness/my-notes.md MINE-RECNOTES
bash /s/step.sh m true
bash /s/step.sh dry ah-$1 uninstall --dry-run
bash /s/step.sh un ah-$1 uninstall --yes
