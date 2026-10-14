bash /s/step.sh o ah-26.125.0 install --track tooling --cli claude
bash /s/step.sh m true
bash /s/step.sh u1 ah-$1 update --only hooks
bash /s/ub.sh u1
bash /s/step.sh u2 ah-$1 update
bash /s/ub.sh u2
