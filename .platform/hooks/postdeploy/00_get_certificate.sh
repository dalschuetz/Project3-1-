#!/usr/bin/env bash
# Place in .platform/hooks/postdeploy directory
sudo certbot -n -d cannontracker.us-east-1.elasticbeanstalk.com --nginx --agree-tos --email dallenschuetzler@gmail.com