printf "%s\n" "{\"mcpServers\":{\"mine\":{\"command\":\"echo\",\"args\":[\"MINEMCP\"]}}}" > .mcp.json
echo MINEMCP >> "$D/tokens.txt"
bash /s/step.sh o ah-26.161.0 install --track csr-supabase --cli claude
bash /s/step.sh m true
bash /s/step.sh u ah-$1 update
bash /s/ub.sh u
